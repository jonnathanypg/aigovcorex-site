from utils.role_helpers import is_multi_center_role
"""Interventions API"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import get_jwt_identity
from middleware.tenant_context import tenant_required, TenantContext
from models import db
from models.intervention import FamilyIntervention
from models.child import Family
from models.user import User
from datetime import date

interventions_bp = Blueprint('interventions', __name__, url_prefix='/interventions')

@interventions_bp.route('/', methods=['GET'])
@tenant_required
def get_interventions():
    """Get all interventions for tenant"""
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
            return jsonify({'interventions': []}), 200

        interventions = FamilyIntervention.query.filter(
            FamilyIntervention.tenant_id.in_(target_tenant_ids)
        ).order_by(FamilyIntervention.date.desc()).all()
        
        return jsonify({'interventions': [i.to_dict() for i in interventions]}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@interventions_bp.route('/', methods=['POST'])
@tenant_required
def create_intervention():
    """Create new intervention"""
    db.session.rollback()  # Preventive rollback
    tenant_id = TenantContext.get_current_tenant_id()
    user = TenantContext.get_current_user()
    data = request.get_json()
    
    try:
        family_id = data.get('family_id')
        
        # Determine tenant_id
        if family_id:
             family = Family.query.get(family_id)
             if not family:
                 return jsonify({'error': 'Familia no encontrada'}), 404
             tenant_id = family.tenant_id
        elif is_multi_center_role(user):
             # Creating new family as admin requires tenant_id
             req_tenant_id = data.get('tenant_id')
             if req_tenant_id:
                 tenant_id = req_tenant_id
             else:
                 return jsonify({'error': 'Se requiere tenant_id para crear familia'}), 400
        
        # If family_name is provided instead of family_id, create family with representative
        if not family_id and data.get('family_name'):
            family_name = data.get('family_name', '')
            
            # Create new family record
            family = Family(
                tenant_id=tenant_id,
                phone_primary=data.get('phone', ''),
            )
            db.session.add(family)
            db.session.flush()
            
            # Import Representative model
            from models.child import Representative
            
            # Create a representative with the family name to store the surname
            representative = Representative(
                family_id=family.id,
                first_name='Representante',
                last_name=family_name,  # Store the family name as last_name
                relationship='otro',
                is_primary=True
            )
            db.session.add(representative)
            db.session.flush()
            
            family_id = family.id
        
        if not family_id:
            return jsonify({'error': 'Se requiere family_id o family_name'}), 400
            
        intervention = FamilyIntervention(
            tenant_id=tenant_id,
            family_id=family_id,
            date=data.get('date', date.today()),
            type=data['type'],
            reason=data.get('reason'),
            notes=data.get('notes'),
            professional_id=user.id,
            status=data.get('status', 'programada'),
            interviewee_name=data.get('interviewee_name'),
            interviewee_relationship=data.get('interviewee_relationship')
        )
        
        db.session.add(intervention)
        db.session.commit()
        
        return jsonify({'message': 'Intervención creada', 'intervention': intervention.to_dict()}), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ========================
# INTERVENTIONS EDIT/DELETE
# ========================

@interventions_bp.route('/<int:intervention_id>', methods=['GET'])
@tenant_required
def get_intervention(intervention_id):
    """Get a specific intervention"""
    db.session.rollback()
    
    try:
        user = TenantContext.get_current_user()
        intervention = FamilyIntervention.query.get(intervention_id)
        
        if not intervention:
            return jsonify({'error': 'Intervención no encontrada'}), 404
        
        # Permission check
        if not is_multi_center_role(user):
            if intervention.tenant_id != user.tenant_id:
                return jsonify({'error': 'No tienes acceso'}), 403
        
        return jsonify({'intervention': intervention.to_dict()}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@interventions_bp.route('/<int:intervention_id>', methods=['PUT'])
@tenant_required
def update_intervention(intervention_id):
    """Update an intervention"""
    db.session.rollback()
    
    try:
        user = TenantContext.get_current_user()
        intervention = FamilyIntervention.query.get(intervention_id)
        
        if not intervention:
            return jsonify({'error': 'Intervención no encontrada'}), 404
        
        # Permission check
        if not is_multi_center_role(user):
            if intervention.tenant_id != user.tenant_id:
                return jsonify({'error': 'No tienes acceso'}), 403
        
        data = request.get_json()
        
        # Update allowed fields
        for field in ['type', 'reason', 'notes', 'status', 'date', 'interviewee_name', 'interviewee_relationship']:
            if field in data:
                value = data[field]
                if field == 'date' and value:
                    value = date.fromisoformat(value) if isinstance(value, str) else value
                setattr(intervention, field, value)
        
        db.session.commit()
        
        return jsonify({
            'message': 'Intervención actualizada',
            'intervention': intervention.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@interventions_bp.route('/<int:intervention_id>', methods=['DELETE'])
@tenant_required
def delete_intervention(intervention_id):
    """Delete an intervention"""
    db.session.rollback()
    
    try:
        user = TenantContext.get_current_user()
        intervention = FamilyIntervention.query.get(intervention_id)
        
        if not intervention:
            return jsonify({'error': 'Intervención no encontrada'}), 404
        
        # Permission check
        if not is_multi_center_role(user):
            if intervention.tenant_id != user.tenant_id:
                return jsonify({'error': 'No tienes acceso'}), 403
        
        db.session.delete(intervention)
        db.session.commit()
        
        return jsonify({'message': 'Intervención eliminada'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
