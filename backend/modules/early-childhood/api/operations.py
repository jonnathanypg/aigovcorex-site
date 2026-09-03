from utils.role_helpers import is_multi_center_role
"""Operations API"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import get_jwt_identity
from middleware.tenant_context import tenant_required, TenantContext
from models import db
from models.operation import MaintenanceTask
from models.user import User
from datetime import date

operations_bp = Blueprint('operations', __name__, url_prefix='/operations')

@operations_bp.route('/', methods=['GET'])
@tenant_required
def get_tasks():
    """Get all maintenance tasks for tenant"""
    try:
        user = TenantContext.get_current_user()
        requested_tenant_id = request.args.get('tenant_id', type=int)
        target_tenant_ids = []

        if is_multi_center_role(user):
            from models.license import LicenseAdmin
            from models.tenant import Tenant
            lic_admin = LicenseAdmin.query.filter_by(user_id=user.id).first()
            if lic_admin:
                all_tenants = Tenant.query.filter_by(license_id=lic_admin.license_id, is_active=True).all()
                allowed_ids = [t.id for t in all_tenants]
                if requested_tenant_id:
                    if requested_tenant_id in allowed_ids: target_tenant_ids = [requested_tenant_id]
                    else: return jsonify({'error': 'Acceso denegado'}), 403
                else: target_tenant_ids = allowed_ids
        else:
            target_tenant_ids = [TenantContext.get_current_tenant_id()]

        if not target_tenant_ids:
            return jsonify({'tasks': []}), 200

        # Build query
        query = MaintenanceTask.query.filter(
            MaintenanceTask.tenant_id.in_(target_tenant_ids)
        )
        
        # Non-admin/coordinator users only see tasks assigned to them
        if user.role.name not in ['license_admin', 'coordinator', 'admin', 'super_admin']:
            query = query.filter(MaintenanceTask.assigned_to_id == user.id)
        
        tasks = query.order_by(MaintenanceTask.date_created.desc()).all()
        
        return jsonify({'tasks': [t.to_dict() for t in tasks]}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@operations_bp.route('/', methods=['POST'])
@tenant_required
def create_task():
    """Create new maintenance task"""
    db.session.rollback()  # Preventive rollback
    
    user = TenantContext.get_current_user()
    current_tenant_id = TenantContext.get_current_tenant_id()
    data = request.get_json()
    
    try:
        # Determine Tenant ID
        target_tenant_id = current_tenant_id
        
        # License Admin can assign to any center in their license
        if is_multi_center_role(user):
            requested_tenant_id = data.get('target_tenant_id') or data.get('center_id')
            if requested_tenant_id:
                # Verify access
                from models.license import LicenseAdmin
                from models.tenant import Tenant
                lic_admin = LicenseAdmin.query.filter_by(user_id=user.id).first()
                if lic_admin:
                    target_tenant = Tenant.query.filter_by(id=requested_tenant_id, license_id=lic_admin.license_id).first()
                    if target_tenant:
                        target_tenant_id = target_tenant.id
                    else:
                        return jsonify({'error': 'No tiene permiso para este centro'}), 403
        
        # Coordinator can only assign to their center (default)
        if user.role.name == 'coordinator' and data.get('target_tenant_id') and int(data['target_tenant_id']) != current_tenant_id:
             return jsonify({'error': 'Solo puede crear tareas para su centro'}), 403

        # Map priority to valid enum values
        priority = data.get('priority', 'media')
        priority_map = {'alta': 'Alta', 'media': 'Media', 'baja': 'Baja', 'critica': 'Critica'}
        priority = priority_map.get(priority.lower(), 'Media') if priority else 'Media'
        
        task = MaintenanceTask(
            tenant_id=target_tenant_id,
            description=data.get('task', data.get('description', 'Sin descripción')),
            center_area=data.get('center_area', data.get('center', '')),
            notes=data.get('notes', ''),
            status=data.get('status', 'Pendiente'),
            priority=priority,
            assigned_to_id=data.get('assigned_to_id')
        )
        
        # Handle date_due if provided
        if data.get('date_due'):
            from datetime import datetime
            task.date_due = datetime.strptime(data['date_due'], '%Y-%m-%d').date()
        
        db.session.add(task)
        db.session.commit()
        
        # Send email to assigned user (non-blocking)
        if task.assigned_to_id:
            try:
                from services.email_service import EmailService
                assignee = User.query.get(task.assigned_to_id)
                license_id = EmailService._get_license_id_from_tenant(target_tenant_id)
                if assignee and license_id and assignee.email:
                    html = EmailService.template_task_assigned(
                        user_name=f"{assignee.first_name} {assignee.last_name}",
                        task_title=task.description or 'Tarea de Mantenimiento',
                        task_description=task.notes or '',
                        priority=task.priority or 'Media'
                    )
                    EmailService.send_email(license_id, assignee.email, "Nueva Tarea Asignada", html)
            except Exception as email_err:
                import logging
                logging.getLogger(__name__).warning(f"Email to assignee failed: {email_err}")
        
        return jsonify({'message': 'Tarea creada', 'task': task.to_dict()}), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@operations_bp.route('/<int:task_id>', methods=['PUT'])
@tenant_required
def update_task(task_id):
    """Update task status or details"""
    # Note: We need to find the task regardless of current tenant context 
    # because license_admin might be viewing a different center context
    # But for security, we check permissions below.
    task = MaintenanceTask.query.get(task_id)
    
    if not task:
        return jsonify({'error': 'Tarea no encontrada'}), 404
        
    user = TenantContext.get_current_user()
    
    # Permission Check
    can_edit_full = False
    is_assignee = task.assigned_to_id == user.id
    
    # License Admin (Global Edit)
    if is_multi_center_role(user):
        from models.license import LicenseAdmin
        lic_admin = LicenseAdmin.query.filter_by(user_id=user.id).first()
        if lic_admin and task.tenant.license_id == lic_admin.license_id:
            can_edit_full = True
            
    # Coordinator (Center Edit)
    elif user.role.name == 'coordinator' and user.tenant_id == task.tenant_id:
        can_edit_full = True
        
    # Check if user has ANY permission
    if not (can_edit_full or is_assignee):
        return jsonify({'error': 'No tiene permisos para editar esta tarea'}), 403
        
    data = request.get_json()
    
    try:
        if can_edit_full:
            # Update all fields
            if 'task' in data: task.description = data['task']
            if 'description' in data: task.description = data['description']
            if 'center_area' in data: task.center_area = data['center_area']
            if 'notes' in data: task.notes = data['notes']
            if 'assigned_to_id' in data: task.assigned_to_id = data['assigned_to_id']
            if 'priority' in data: 
                priority = data['priority']
                priority_map = {'alta': 'Alta', 'media': 'Media', 'baja': 'Baja', 'critica': 'Critica'}
                task.priority = priority_map.get(priority.lower(), 'Media')
            if 'status' in data: task.status = data['status']
            if 'date_due' in data:
                from datetime import datetime
                task.date_due = datetime.strptime(data['date_due'], '%Y-%m-%d').date()
                
        elif is_assignee:
            # Only update status
            if 'status' in data:
                task.status = data['status']
            else:
                return jsonify({'error': 'Solo puede actualizar el estado de su tarea asignada'}), 403
            
        db.session.commit()
        return jsonify({'message': 'Tarea actualizada', 'task': task.to_dict()}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@operations_bp.route('/<int:task_id>', methods=['DELETE'])
@tenant_required
def delete_task(task_id):
    """Delete a maintenance task (license_admin only)"""
    task = MaintenanceTask.query.get(task_id)
    
    if not task:
        return jsonify({'error': 'Tarea no encontrada'}), 404
        
    user = TenantContext.get_current_user()
    
    # Only license_admin can delete
    if not is_multi_center_role(user):
        return jsonify({'error': 'Solo el administrador de licencia puede eliminar tareas'}), 403
    
    # Verify task belongs to admin's license
    from models.license import LicenseAdmin
    lic_admin = LicenseAdmin.query.filter_by(user_id=user.id).first()
    if not lic_admin or task.tenant.license_id != lic_admin.license_id:
        return jsonify({'error': 'No tiene permiso para eliminar esta tarea'}), 403
    
    try:
        db.session.delete(task)
        db.session.commit()
        return jsonify({'message': 'Tarea eliminada exitosamente'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
