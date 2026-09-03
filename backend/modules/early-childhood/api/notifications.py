from utils.role_helpers import is_multi_center_role
"""Notifications API - Full CRUD with role-based permissions"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import get_jwt_identity
from middleware.tenant_context import tenant_required, TenantContext
from models import db
from models.notification import Notification
from models.user import User
import logging

logger = logging.getLogger(__name__)

notifications_bp = Blueprint('notifications', __name__, url_prefix='/notifications')


def _get_allowed_tenant_ids(user, requested_tenant_id=None):
    """Get allowed tenant IDs for the current user"""
    if is_multi_center_role(user):
        from models.license import LicenseAdmin
        from models.tenant import Tenant
        lic_admin = LicenseAdmin.query.filter_by(user_id=user.id).first()
        if lic_admin:
            all_tenants = Tenant.query.filter_by(license_id=lic_admin.license_id, is_active=True).all()
            allowed_ids = [t.id for t in all_tenants]
            if requested_tenant_id:
                if requested_tenant_id in allowed_ids:
                    return [requested_tenant_id]
                else:
                    return None  # Access denied
            return allowed_ids
    return [TenantContext.get_current_tenant_id()]


@notifications_bp.route('/', methods=['GET'])
@tenant_required
def get_notifications():
    """Get all communal notifications for user's center(s) with scheduled visibility"""
    try:
        user = TenantContext.get_current_user()
        requested_tenant_id = request.args.get('tenant_id', type=int)
        target_tenant_ids = _get_allowed_tenant_ids(user, requested_tenant_id)

        if target_tenant_ids is None:
            return jsonify({'error': 'Acceso denegado'}), 403

        if not target_tenant_ids:
            return jsonify({'notifications': []}), 200

        from datetime import datetime
        # Comparar con UTC naive; start_at/end_at se guardan en UTC (naive) en la BD
        now = datetime.utcnow()

        from sqlalchemy import or_, text
        
        # Build query: include if it's for user's center OR user's center is in target_tenants
        notifications_query = Notification.query.filter(
            or_(
                Notification.tenant_id.in_(target_tenant_ids),
                # Check if target_tenants JSON contains any of target_tenant_ids
                # Using a raw SQL fallback for JSON matching is safer here for MySQL
                *[text(f"JSON_CONTAINS(target_tenants, '{tid}')") for tid in target_tenant_ids]
            )
        )
        
        # Apply visibility filters
        notifications_query = notifications_query.filter(
            or_(Notification.start_at == None, Notification.start_at <= now),
            or_(Notification.end_at == None, Notification.end_at >= now)
        )

        notifications = notifications_query.order_by(Notification.created_at.desc()).limit(100).all()
        
        return jsonify({'notifications': [n.to_dict() for n in notifications]}), 200
    except Exception as e:
        logger.error(f"Error fetching notifications: {e}")
        return jsonify({'error': str(e)}), 500


@notifications_bp.route('/', methods=['POST'])
@tenant_required
def create_notification():
    """Create a new communal notification (with optional broadcast and scheduling)"""
    try:
        user = TenantContext.get_current_user()
        data = request.get_json()
        
        if not data or not data.get('title'):
            return jsonify({'error': 'El título es obligatorio'}), 400
        
        # Determine target_tenant_id and target_tenants
        target_tenant_id = None
        target_tenants = None
        
        from datetime import datetime, timezone
        
        def _parse_utc(s):
            if not s:
                return None
            try:
                raw = s.replace('Z', '+00:00')
                dt = datetime.fromisoformat(raw)
                # Si viene sin zona horaria (ej. datetime-local antiguo), asumir UTC
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                return dt.astimezone(timezone.utc).replace(tzinfo=None)  # guardar naive UTC en DB
            except ValueError:
                return None

        start_at = _parse_utc(data.get('start_at'))
        end_at = _parse_utc(data.get('end_at'))

        if start_at and end_at and end_at <= start_at:
            return jsonify({
                'error': 'La fecha/hora de "Ocultar en" debe ser posterior a "Mostrar desde".'
            }), 400

        if is_multi_center_role(user):
            # License admin can broadcast to multiple centers
            target_tenants = data.get('target_tenants') # Expect list of IDs
            if target_tenants:
                if not isinstance(target_tenants, list):
                    return jsonify({'error': 'target_tenants debe ser una lista'}), 400
                # Just use the first one as primary tenant_id (for owner center)
                target_tenant_id = target_tenants[0] if target_tenants else None
            else:
                target_tenant_id = request.args.get('tenant_id', type=int) or data.get('tenant_id')
                
            if not target_tenant_id:
                return jsonify({'error': 'Debe seleccionar al menos un centro'}), 400
                
            allowed = _get_allowed_tenant_ids(user, target_tenant_id)
            if allowed is None:
                return jsonify({'error': 'Acceso denegado al centro'}), 403
        else:
            target_tenant_id = TenantContext.get_current_tenant_id()
        
        if not target_tenant_id:
            return jsonify({'error': 'Centro no identificado'}), 400
        
        notification = Notification(
            tenant_id=target_tenant_id,
            title=data['title'].strip(),
            description=data.get('description', '').strip(),
            type=data.get('type', 'Info'),
            created_by_id=user.id,
            user_id=None,
            start_at=start_at,
            end_at=end_at,
            target_tenants=target_tenants
        )
        
        db.session.add(notification)
        db.session.commit()
        
        logger.info(f"Notification created (Broadcast: {target_tenants is not None})")
        
        # Send email to all center members (non-blocking)
        try:
            from services.email_service import EmailService
            # Resolve license_id
            license_id = EmailService._get_license_id_from_tenant(target_tenant_id)
            if license_id:
                html = EmailService.template_notification(
                    title=notification.title,
                    message=notification.description or ''
                )
                tenant_ids_to_notify = target_tenants if target_tenants else [target_tenant_id]
                for tid in tenant_ids_to_notify:
                    EmailService.send_to_center_members(license_id, tid, f"Notificación: {notification.title}", html)
        except Exception as email_err:
            logger.warning(f"Email broadcast for notification failed: {email_err}")
        
        return jsonify({
            'message': 'Notificación creada exitosamente',
            'notification': notification.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error creating notification: {e}")
        return jsonify({'error': str(e)}), 500


@notifications_bp.route('/<int:notif_id>', methods=['DELETE'])
@tenant_required
def delete_notification(notif_id):
    """
    Delete a notification - role-based:
    - coordinator / license_admin: can delete ANY notification in their scope
    - other roles: can only delete notifications they created
    """
    try:
        user = TenantContext.get_current_user()
        user_id = user.id
        user_role = user.role.name
        
        notification = Notification.query.get(notif_id)
        
        if not notification:
            return jsonify({'error': 'Notificación no encontrada'}), 404
        
        # Check access scope
        allowed_ids = _get_allowed_tenant_ids(user)
        if not allowed_ids or notification.tenant_id not in allowed_ids:
            return jsonify({'error': 'Acceso denegado'}), 403
        
        # Permission check
        can_delete_any = user_role in ('coordinator', 'license_admin', 'super_admin')
        is_owner = notification.created_by_id == user_id
        
        if not can_delete_any and not is_owner:
            return jsonify({'error': 'Solo puede eliminar sus propias notificaciones'}), 403
        
        db.session.delete(notification)
        db.session.commit()
        
        logger.info(f"Notification {notif_id} deleted by user {user_id} (role: {user_role})")
        
        return jsonify({'message': 'Notificación eliminada correctamente'}), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deleting notification: {e}")
        return jsonify({'error': str(e)}), 500


@notifications_bp.route('/<int:notif_id>/read', methods=['POST'])
@tenant_required
def mark_read(notif_id):
    """Mark notification as read"""
    try:
        user = TenantContext.get_current_user()
        allowed_ids = _get_allowed_tenant_ids(user)
        
        notification = Notification.query.get(notif_id)
        
        if not notification:
            return jsonify({'error': 'Notificación no encontrada'}), 404
        
        if not allowed_ids or notification.tenant_id not in allowed_ids:
            return jsonify({'error': 'Acceso denegado'}), 403
        
        notification.read = True
        db.session.commit()
        
        return jsonify({'message': 'Marcada como leída'}), 200
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error marking notification as read: {e}")
        return jsonify({'error': str(e)}), 500
