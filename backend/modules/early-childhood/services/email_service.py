"""
Email Service - Multi-Tenant SMTP Email System
Sends emails using the SMTP credentials configured per License (Organization).
"""
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from models import db
from models.license import License
from models.user import User

logger = logging.getLogger(__name__)


class EmailService:
    """
    Servicio centralizado de envío de correos electrónicos.
    Busca las credenciales SMTP de la organización (License) y envía emails.
    """

    @staticmethod
    def _get_smtp_config(license_id: int) -> dict | None:
        """Obtener configuración SMTP de la licencia."""
        license_obj = License.query.get(license_id)
        if not license_obj:
            logger.warning(f"License {license_id} not found for email sending.")
            return None
        if not all([license_obj.smtp_host, license_obj.smtp_user, license_obj.smtp_password]):
            logger.warning(f"SMTP not configured for license {license_id} ({license_obj.name}).")
            return None
        return {
            'host': license_obj.smtp_host,
            'port': license_obj.smtp_port or 587,
            'user': license_obj.smtp_user,
            'password': license_obj.smtp_password,
            'from_name': license_obj.legal_name or license_obj.name,
        }

    @staticmethod
    def _get_license_id_from_tenant(tenant_id: int) -> int | None:
        """Resolver license_id desde un tenant_id."""
        from models.tenant import Tenant
        tenant = Tenant.query.get(tenant_id)
        return tenant.license_id if tenant else None

    @staticmethod
    def send_email(
        license_id: int,
        to_email: str,
        subject: str,
        html_body: str,
        text_body: str | None = None,
    ) -> bool:
        """
        Enviar un correo electrónico usando las credenciales SMTP de la licencia.
        Returns True si se envió correctamente, False en caso contrario.
        """
        config = EmailService._get_smtp_config(license_id)
        if not config:
            return False

        try:
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = f"{config['from_name']} <{config['user']}>"
            msg['To'] = to_email

            # Attach text fallback
            if text_body:
                msg.attach(MIMEText(text_body, 'plain', 'utf-8'))
            # Attach HTML body
            msg.attach(MIMEText(html_body, 'html', 'utf-8'))

            port = int(config['port'])
            if port == 465:
                # SSL connection (e.g., Hostinger, older Gmail settings)
                with smtplib.SMTP_SSL(config['host'], port, timeout=15) as server:
                    server.login(config['user'], config['password'])
                    server.sendmail(config['user'], to_email, msg.as_string())
            else:
                # TLS/STARTTLS connection (e.g., port 587)
                with smtplib.SMTP(config['host'], port, timeout=15) as server:
                    server.ehlo()
                    server.starttls()
                    server.ehlo()
                    server.login(config['user'], config['password'])
                    server.sendmail(config['user'], to_email, msg.as_string())

            logger.info(f"Email sent to {to_email} via license {license_id}: {subject}")
            return True

        except smtplib.SMTPAuthenticationError:
            logger.error(f"SMTP auth failed for license {license_id}. Check credentials.")
            return False
        except smtplib.SMTPException as e:
            logger.error(f"SMTP error sending to {to_email}: {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error sending email to {to_email}: {e}")
            return False

    # ─── Convenience Methods (Auto-Resolution) ─────────────────────────

    @staticmethod
    def send_to_user(license_id: int, user_id: int, subject: str, html_body: str) -> bool:
        """Enviar correo a un usuario del sistema, resolviendo su email automáticamente."""
        user = User.query.get(user_id)
        if not user or not user.email:
            logger.warning(f"User {user_id} not found or has no email.")
            return False
        return EmailService.send_email(license_id, user.email, subject, html_body)

    @staticmethod
    def send_to_child_parent(license_id: int, child_id: int, subject: str, html_body: str) -> bool:
        """Enviar correo al representante principal de un niño."""
        from models.child import Child
        child = Child.query.get(child_id)
        if not child or not child.family_id:
            logger.warning(f"Child {child_id} not found or has no family.")
            return False

        from models.child import Representative
        rep = Representative.query.filter_by(
            family_id=child.family_id, is_primary=True
        ).first()

        if not rep:
            # Fallback: try any representative with an email
            rep = Representative.query.filter(
                Representative.family_id == child.family_id,
                Representative.email.isnot(None),
                Representative.email != ''
            ).first()

        if not rep or not rep.email:
            logger.warning(f"No representative email found for child {child_id}.")
            return False

        return EmailService.send_email(license_id, rep.email, subject, html_body)

    @staticmethod
    def send_to_center_members(license_id: int, tenant_id: int, subject: str, html_body: str) -> int:
        """
        Enviar correo a todos los miembros activos de un centro.
        Retorna la cantidad de correos enviados exitosamente.
        """
        users = User.query.filter_by(tenant_id=tenant_id, is_active=True).all()
        sent = 0
        for user in users:
            if user.email:
                if EmailService.send_email(license_id, user.email, subject, html_body):
                    sent += 1
        return sent

    # ─── Email Templates ──────────────────────────────────────────────

    @staticmethod
    def _base_template(title: str, content: str, footer: str = "") -> str:
        """Genera un template HTML limpio y profesional."""
        return f"""
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="font-family: 'Segoe UI', Arial, sans-serif; background: #f4f6f9; padding: 20px;">
            <div style="max-width: 600px; margin: auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08);">
                <div style="background: linear-gradient(135deg, #d97706, #f59e0b); padding: 24px 32px;">
                    <h1 style="color: #fff; margin: 0; font-size: 22px;">{title}</h1>
                </div>
                <div style="padding: 32px;">
                    {content}
                </div>
                <div style="background: #f9fafb; padding: 16px 32px; text-align: center; color: #6b7280; font-size: 12px;">
                    {footer or 'KindiCore AI — Sistema de Gestión Integral CDI'}
                </div>
            </div>
        </body>
        </html>
        """

    @staticmethod
    def template_user_created(user_name: str, email: str, password: str, org_name: str) -> str:
        """Template de bienvenida cuando se crea un usuario."""
        content = f"""
        <p>Hola <strong>{user_name}</strong>,</p>
        <p>Se ha creado tu cuenta en la plataforma <strong>{org_name}</strong>.</p>
        <div style="background: #fffbeb; border: 1px solid #fcd34d; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <p style="margin: 0;"><strong>Correo:</strong> {email}</p>
            <p style="margin: 4px 0 0;"><strong>Contraseña:</strong> {password}</p>
        </div>
        <p style="color: #6b7280; font-size: 13px;">Te recomendamos cambiar tu contraseña después de iniciar sesión por primera vez.</p>
        """
        return EmailService._base_template("Bienvenido a KindiCore AI", content, org_name)

    @staticmethod
    def template_child_assigned(educator_name: str, child_name: str, center_name: str) -> str:
        """Template cuando se asigna un niño a una educadora."""
        content = f"""
        <p>Hola <strong>{educator_name}</strong>,</p>
        <p>Se te ha asignado un nuevo niño/a:</p>
        <div style="background: #ecfdf5; border: 1px solid #6ee7b7; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <p style="margin: 0; font-size: 18px; font-weight: 600;">{child_name}</p>
            <p style="margin: 4px 0 0; color: #6b7280;">Centro: {center_name}</p>
        </div>
        <p>Puedes ver los detalles del niño en el módulo de <strong>Registro de Niños</strong>.</p>
        """
        return EmailService._base_template("Nueva Asignación de Niño/a", content)

    @staticmethod
    def template_task_assigned(user_name: str, task_title: str, task_description: str, priority: str) -> str:
        """Template cuando se asigna una tarea de mantenimiento."""
        priority_colors = {'alta': '#ef4444', 'media': '#f59e0b', 'baja': '#22c55e'}
        color = priority_colors.get(priority.lower(), '#6b7280')
        content = f"""
        <p>Hola <strong>{user_name}</strong>,</p>
        <p>Se te ha asignado una nueva tarea de operaciones:</p>
        <div style="background: #f0f9ff; border: 1px solid #93c5fd; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <p style="margin: 0; font-size: 18px; font-weight: 600;">{task_title}</p>
            <p style="margin: 8px 0 4px; color: #374151;">{task_description or 'Sin descripción'}</p>
            <span style="background: {color}; color: white; padding: 2px 10px; border-radius: 10px; font-size: 12px;">Prioridad: {priority}</span>
        </div>
        """
        return EmailService._base_template("Nueva Tarea Asignada", content)

    @staticmethod
    def template_notification(title: str, message: str, org_name: str = "") -> str:
        """Template para notificaciones generales del centro."""
        content = f"""
        <p style="font-size: 16px; font-weight: 600; color: #1f2937;">{title}</p>
        <div style="padding: 16px; background: #f9fafb; border-radius: 8px; margin: 12px 0;">
            <p style="margin: 0; color: #374151; line-height: 1.6;">{message}</p>
        </div>
        """
        return EmailService._base_template("Notificación", content, org_name)

    @staticmethod
    def template_generic(subject: str, body: str) -> str:
        """Template genérico para envío por parte del agente IA."""
        content = f"""
        <div style="line-height: 1.6; color: #374151;">
            {body}
        </div>
        """
        return EmailService._base_template(subject, content)
