"""
Analytics Tools for AI Agent
Enable the agent to perform data analysis and retrieval of aggregate metrics.
Supports both single-tenant (coordinator) and multi-tenant (license_admin) scope.
"""
from langchain.tools import BaseTool
from typing import Type, Optional, List
from models import db
from models.attendance import Attendance
from models.health import HealthRecord
from models.child import Child
from sqlalchemy import func, text
from datetime import date, timedelta
import logging

logger = logging.getLogger(__name__)


def resolve_tenant_ids(tenant_id, user_id):
    """
    Resolve the list of tenant IDs for query scope.
    - If tenant_id is provided and valid, returns [tenant_id].
    - If tenant_id is None (license_admin), resolves ALL tenants under the user's license.
    Returns a list of tenant IDs.
    """
    if tenant_id:
        return [int(tenant_id)]
    
    # License Admin: resolve all tenants under their license
    if user_id:
        max_retries = 2
        for attempt in range(max_retries):
            try:
                # Ensure fresh DB session before querying
                from models import db
                if attempt > 0:
                    db.session.rollback()
                    db.session.remove()
                else:
                    # Proactive ping to detect stale connection
                    try:
                        from sqlalchemy import text
                        db.session.execute(text("SELECT 1"))
                    except Exception:
                        db.session.rollback()
                        db.session.remove()
                
                from services.identity_resolver import IdentityResolver
                user = IdentityResolver.get_user_or_virtual(user_id)
                if user and hasattr(user, 'role') and user.role and user.role.name == 'license_admin':
                    from models.license import LicenseAdmin
                    from models.tenant import Tenant
                    lic_admin = LicenseAdmin.query.filter_by(user_id=user.id, is_active=True).first()
                    if lic_admin:
                        tenants = Tenant.query.filter_by(license_id=lic_admin.license_id, is_active=True).all()
                        ids = [t.id for t in tenants]
                        logger.info(f"📊 Analytics: License Admin scope resolved to {len(ids)} tenants: {ids}")
                        return ids
                break  # Query succeeded but user wasn't license_admin or not found
            except Exception as e:
                error_msg = str(e).lower()
                is_conn = any(x in error_msg for x in ['gone away', 'broken pipe', 'lost connection', 'rollback'])
                if is_conn and attempt < max_retries - 1:
                    logger.warning(f"⚠️ DB connection error in resolve_tenant_ids (retry {attempt+1}): {e}")
                    continue
                logger.warning(f"⚠️ Could not resolve tenant scope for user {user_id}: {e}")
    
    return []


class GetTenantAnalyticsTool(BaseTool):
    """Tool to get aggregate analytics for a tenant or across all tenants (license_admin)"""
    name: str = "get_tenant_analytics"
    description: str = (
        "Get aggregate analytics and KPIs for the center or organization "
        "(attendance rates, health compliance, active children). "
        "Input: {'metric': 'asistencia', 'period': 'semana', 'tenant_id': 1, 'user_id': 1}. "
        "For license admins, tenant_id can be omitted to get global analytics."
    )
    
    def _run(self, *args, **kwargs) -> dict:
        metric = kwargs.get('metric', 'general')
        period = kwargs.get('period', 'semana')
        tenant_id = kwargs.get('tenant_id')
        user_id = kwargs.get('user_id')

        # Resolve tenant scope (single or multi-tenant)
        target_ids = resolve_tenant_ids(tenant_id, user_id)
        
        if not target_ids:
            return {
                'success': False, 
                'error': 'No se encontraron centros asignados. Verifique que el usuario tiene centros activos.'
            }

        try:
            today = date.today()
            start_date = today
            
            if period == 'semana':
                start_date = today - timedelta(days=7)
            elif period == 'mes':
                start_date = today.replace(day=1)
            elif period == 'anio':
                start_date = today.replace(month=1, day=1)
                
            result = {'metric': metric, 'period': period, 'scope': f"{len(target_ids)} centro(s)", 'data': {}}
            
            if metric in ['asistencia', 'general']:
                # Attendance Rate (multi-tenant)
                total = Attendance.query.filter(
                    Attendance.tenant_id.in_(target_ids),
                    Attendance.date >= start_date
                ).count()
                
                present = Attendance.query.filter(
                    Attendance.tenant_id.in_(target_ids),
                    Attendance.date >= start_date,
                    Attendance.status == 'presente'
                ).count()
                
                rate = (present / total * 100) if total > 0 else 0
                result['data']['attendance_rate'] = f"{round(rate, 1)}%"
                result['data']['total_records'] = total
                result['data']['present_records'] = present
                
                if total == 0:
                    result['data']['note'] = 'No hay registros de asistencia en este periodo.'
                
            if metric in ['salud', 'general']:
                # Health checks count (multi-tenant)
                checks = HealthRecord.query.filter(
                    HealthRecord.tenant_id.in_(target_ids),
                    HealthRecord.record_date >= start_date
                ).count()
                result['data']['health_checks'] = checks
                
            if metric in ['general']:
                # Active children (multi-tenant)
                active = Child.query.filter(
                    Child.tenant_id.in_(target_ids), 
                    Child.status == 'activo'
                ).count()
                result['data']['active_children'] = active
                
            return {
                'success': True,
                'analytics': result
            }
            
        except Exception as e:
            logger.error(f"❌ Analytics error: {e}")
            return {'success': False, 'error': str(e)}


class AnalyzeTrendsTool(BaseTool):
    """Tool to analyze trends over time (supports multi-tenant for license_admin)"""
    name: str = "analyze_trends"
    description: str = (
        "Analyze trends and patterns in data over time "
        "(e.g., increasing/decreasing attendance). "
        "Input: {'aspect': 'asistencia_trend', 'tenant_id': 1, 'user_id': 1}. "
        "For license admins, tenant_id can be omitted for global trends."
    )
    
    def _run(self, *args, **kwargs) -> dict:
        tenant_id = kwargs.get('tenant_id')
        user_id = kwargs.get('user_id')
        aspect = kwargs.get('aspect', 'asistencia_trend')

        # Resolve tenant scope
        target_ids = resolve_tenant_ids(tenant_id, user_id)
        
        if not target_ids:
            return {
                'success': False, 
                'error': 'No se encontraron centros asignados.'
            }

        try:
            today = date.today()
            last_month = today - timedelta(days=30)
            
            if aspect == 'asistencia_trend':
                records = Attendance.query.filter(
                    Attendance.tenant_id.in_(target_ids),
                    Attendance.date >= last_month
                ).order_by(Attendance.date).all()
                
                if not records:
                    return {
                        'success': True, 
                        'trend': 'Sin datos',
                        'details': 'No hay registros de asistencia en los últimos 30 días.'
                    }
                
                # Split into halves for trend comparison
                first_half = records[:len(records)//2]
                second_half = records[len(records)//2:]
                
                rate1 = sum(1 for r in first_half if r.status == 'presente') / len(first_half) if first_half else 0
                rate2 = sum(1 for r in second_half if r.status == 'presente') / len(second_half) if second_half else 0
                
                trend = "Estable"
                if rate2 > rate1 + 0.05:
                    trend = "Mejorando"
                elif rate2 < rate1 - 0.05:
                    trend = "Disminuyendo"
                
                return {
                    'success': True,
                    'trend': trend,
                    'scope': f"{len(target_ids)} centro(s)",
                    'details': f"Tasa anterior: {round(rate1*100)}%, Tasa actual: {round(rate2*100)}%",
                    'total_records': len(records)
                }
                
            return {'success': False, 'error': f'Aspecto "{aspect}" no soportado. Use: asistencia_trend'}
            
        except Exception as e:
            logger.error(f"❌ Trend analysis error: {e}")
            return {'success': False, 'error': str(e)}
