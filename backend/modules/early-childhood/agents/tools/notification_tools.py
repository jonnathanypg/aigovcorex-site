"""
Notification Tools for AI Agent
Enable the agent to create system notifications.
Supports multi-tenant broadcasting for license_admin users.
"""
from langchain.tools import BaseTool
from typing import Type
from models import db
from models.notification import Notification
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class CreateNotificationTool(BaseTool):
    """Tool to create a system notification (supports multi-tenant for license_admin)"""
    name: str = "create_notification"
    description: str = (
        "Create a visible notification for users in the dashboard. "
        "Use this to alert about low attendance, health issues, or analysis results. "
        "Input: {'title': 'Título', 'message': 'Mensaje', 'type': 'Info', 'tenant_id': 1, 'user_id': 1}. "
        "For license admins, tenant_id can be omitted to send to ALL centers."
    )
    
    def _run(self, *args, **kwargs) -> dict:
        title = kwargs.get('title')
        message = kwargs.get('message')
        notif_type = kwargs.get('type', 'Info')
        tenant_id = kwargs.get('tenant_id')
        user_id = kwargs.get('user_id')

        if not all([title, message]):
            return {'success': False, 'error': 'Título y mensaje son requeridos.'}

        # Resolve target tenant(s) using shared helper with DB recovery
        from agents.tools.analytics_tools import resolve_tenant_ids
        target_ids = resolve_tenant_ids(tenant_id, user_id)

        if not target_ids:
            return {'success': False, 'error': 'No se encontraron centros para enviar la notificación.'}

        try:
            created_count = 0
            for tid in target_ids:
                notification = Notification(
                    tenant_id=tid,
                    title=title,
                    description=message,
                    type=notif_type,
                    created_at=datetime.utcnow()
                )
                db.session.add(notification)
                created_count += 1
            
            db.session.commit()
            
            return {
                'success': True,
                'message': f'Notificación creada en {created_count} centro(s): {title}',
                'centers_notified': created_count
            }
            
        except Exception as e:
            db.session.rollback()
            return {'success': False, 'error': str(e)}

