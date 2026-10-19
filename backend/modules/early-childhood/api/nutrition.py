from utils.role_helpers import is_multi_center_role
"""
Nutrition API for KindiCoreAI
Handles menu planning, daily consumption tracking, and nutrition alerts
"""
from flask import Blueprint, request, jsonify
from models import db
from models.nutrition import NutritionDaily, Menu, NutritionAlert, ChildNutritionalAssessment
from models.child import Child
from models.attendance import Attendance
from models.health import HealthRecord
from models.user import User
from services.who_standards import WHOStandardsService
from middleware.tenant_context import tenant_required, TenantContext
from datetime import date, timedelta
from sqlalchemy import or_, and_

nutrition_bp = Blueprint('nutrition', __name__, url_prefix='/nutrition')


def get_week_start(d):
    """Get Monday of the current week"""
    return d - timedelta(days=d.weekday())


@nutrition_bp.route('/menu/current', methods=['GET'])
@tenant_required
def get_current_menu():
    """Get menu for current week"""
    db.session.rollback()
    
    try:
        user = TenantContext.get_current_user()
        week_start = request.args.get('week_start')
        if week_start:
            week_start = date.fromisoformat(week_start)
        else:
            week_start = get_week_start(date.today())
        
        target_tenant_id = None
        target_license_id = None
        requested_tenant_id = request.args.get('tenant_id', type=int)

        from models.tenant import Tenant
        from models.license import LicenseAdmin
        
        if is_multi_center_role(user):
            lic_admin = LicenseAdmin.query.filter_by(user_id=user.id).first()
            if lic_admin:
                target_license_id = lic_admin.license_id
                if requested_tenant_id:
                    t = Tenant.query.get(requested_tenant_id)
                    if t and t.license_id == lic_admin.license_id:
                        target_tenant_id = requested_tenant_id
        elif user.tenant_id:
            target_tenant_id = user.tenant_id
            tenant = Tenant.query.get(user.tenant_id)
            if tenant:
                target_license_id = tenant.license_id
        
        if not target_tenant_id and not target_license_id:
            return jsonify({
                'week_start': week_start.isoformat(),
                'menu_by_day': {},
                'menus': []
            }), 200

        from sqlalchemy import or_, and_
        conditions = [Menu.week_start_date == week_start]
        or_conds = []
        if target_tenant_id:
            or_conds.append(Menu.tenant_id == target_tenant_id)
        if target_license_id:
            or_conds.append(and_(Menu.license_id == target_license_id, Menu.tenant_id == None))
            
        conditions.append(or_(*or_conds))
        
        menus = Menu.query.filter(*conditions).order_by(Menu.day_of_week, Menu.meal_type).all()
        
        # Merge menus: tenant_id overrides global
        merged_menus = {}
        for menu in menus:
            key = (menu.day_of_week, menu.meal_type)
            if key not in merged_menus:
                 merged_menus[key] = menu
            else:
                 if menu.tenant_id is not None:
                      merged_menus[key] = menu
                      
        final_menus = list(merged_menus.values())
        
        # Organize by day
        menu_by_day = {}
        for menu in final_menus:
            day = menu.day_of_week
            if day not in menu_by_day:
                menu_by_day[day] = {'day_name': menu.day_name, 'meals': {}}
            menu_by_day[day]['meals'][menu.meal_type] = menu.to_dict()
        
        return jsonify({
            'week_start': week_start.isoformat(),
            'menu_by_day': menu_by_day,
            'menus': [m.to_dict() for m in final_menus]
        }), 200
        
    except Exception as e:
        db.session.rollback()
        import traceback
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500


@nutrition_bp.route('/menu', methods=['POST'])
@tenant_required
def create_or_update_menu():
    """Create or update menu for a specific slot"""
    db.session.rollback()
    
    try:
        user = TenantContext.get_current_user()
        data = request.get_json()
        
        week_start = date.fromisoformat(data['week_start_date']) if data.get('week_start_date') else get_week_start(date.today())
        day_of_week = data['day_of_week']
        meal_type = data['meal_type']
        
        target_tenant_id = None
        target_license_id = None
        
        from utils.role_helpers import is_multi_center_role, get_license_id_for_user
        
        if is_multi_center_role(user):
            target_license_id = get_license_id_for_user(user)
            if 'tenant_id' in data and data['tenant_id']:
                target_tenant_id = data['tenant_id']
            elif user.tenant_id:
                target_tenant_id = user.tenant_id
        elif user.tenant_id:
            target_tenant_id = user.tenant_id
            tenant = Tenant.query.get(user.tenant_id)
            if tenant:
                target_license_id = tenant.license_id
            else:
                target_license_id = get_license_id_for_user(user)
        else:
            target_license_id = get_license_id_for_user(user)
        
        if not target_tenant_id and not target_license_id:
             return jsonify({'error': 'Se requiere tenant_id o license_id'}), 400

        # Find existing or create new
        query = Menu.query.filter_by(
            week_start_date=week_start,
            day_of_week=day_of_week,
            meal_type=meal_type
        )
        if target_tenant_id:
            query = query.filter_by(tenant_id=target_tenant_id)
        else:
            query = query.filter_by(license_id=target_license_id, tenant_id=None)
            
        menu = query.first()
        
        if not menu:
            menu = Menu(
                tenant_id=target_tenant_id,
                license_id=target_license_id if not target_tenant_id else None,
                week_start_date=week_start,
                day_of_week=day_of_week,
                meal_type=meal_type
            )
            db.session.add(menu)
        
        menu.description = data['description']
        menu.ingredients = data.get('ingredients', [])
        menu.calories = data.get('calories')
        menu.created_by_id = user.id
        
        db.session.commit()
        
        return jsonify({
            'message': 'Menú guardado',
            'menu': menu.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        import traceback
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500


@nutrition_bp.route('/menu/today', methods=['GET'])
@tenant_required
def get_today_menu():
    """Get menu for today"""
    db.session.rollback()
    
    try:
        user = TenantContext.get_current_user()
        today_str = request.args.get('date')
        if today_str:
            today = date.fromisoformat(today_str)
        else:
            today = date.today()
            
        week_start = get_week_start(today)
        day_of_week = today.weekday() + 1  # 1=Monday
        
        target_tenant_id = None
        target_license_id = None
        requested_tenant_id = request.args.get('tenant_id', type=int)
        
        from models.tenant import Tenant
        from models.license import LicenseAdmin
        
        if is_multi_center_role(user):
            lic_admin = LicenseAdmin.query.filter_by(user_id=user.id).first()
            if lic_admin:
                target_license_id = lic_admin.license_id
                if requested_tenant_id:
                    t = Tenant.query.get(requested_tenant_id)
                    if t and t.license_id == lic_admin.license_id:
                        target_tenant_id = requested_tenant_id
        elif user.tenant_id:
            target_tenant_id = user.tenant_id
            tenant = Tenant.query.get(user.tenant_id)
            if tenant:
                target_license_id = tenant.license_id
        
        if not target_tenant_id and not target_license_id:
            return jsonify({
                'date': today.isoformat(),
                'day_name': ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'][today.weekday()],
                'meals': {}
            }), 200

        from sqlalchemy import or_, and_
        conditions = [
            Menu.week_start_date == week_start,
            Menu.day_of_week == day_of_week
        ]
        or_conds = []
        if target_tenant_id:
            or_conds.append(Menu.tenant_id == target_tenant_id)
        if target_license_id:
            or_conds.append(and_(Menu.license_id == target_license_id, Menu.tenant_id == None))
            
        conditions.append(or_(*or_conds))
        
        menus = Menu.query.filter(*conditions).order_by(Menu.meal_type).all()
        
        # Merge menus: tenant_id overrides global
        merged_menus = {}
        for menu in menus:
            key = menu.meal_type
            if key not in merged_menus:
                 merged_menus[key] = menu
            else:
                 if menu.tenant_id is not None:
                      merged_menus[key] = menu
                      
        final_menus = list(merged_menus.values())
        
        return jsonify({
            'date': today.isoformat(),
            'day_name': ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'][today.weekday()],
            'meals': {m.meal_type: m.to_dict() for m in final_menus}
        }), 200
        
    except Exception as e:
        db.session.rollback()
        import traceback
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500


@nutrition_bp.route('/rations', methods=['GET'])
@tenant_required
def get_rations():
    """Get consumption records for a specific date"""
    db.session.rollback()
    
    try:
        user = TenantContext.get_current_user()
        ration_date = request.args.get('date')
        if ration_date:
            ration_date = date.fromisoformat(ration_date)
        else:
            ration_date = date.today()
        
        meal_type = request.args.get('meal_type')
        
        target_tenant_ids = []
        requested_tenant_id = request.args.get('tenant_id', type=int)
        
        if is_multi_center_role(user):
            from models.license import LicenseAdmin
            from models.tenant import Tenant
            lic_admin = LicenseAdmin.query.filter_by(user_id=user.id).first()
            if lic_admin:
                all_tenants = Tenant.query.filter_by(license_id=lic_admin.license_id).all()
                allowed_ids = [t.id for t in all_tenants]
                
                if requested_tenant_id:
                    if requested_tenant_id in allowed_ids:
                        target_tenant_ids = [requested_tenant_id]
                else:
                    target_tenant_ids = allowed_ids
        elif user.tenant_id:
            target_tenant_ids = [user.tenant_id]
        
        if not target_tenant_ids:
            return jsonify({
                'date': ration_date.isoformat(),
                'rations': []
            }), 200

        query = NutritionDaily.query.filter(
            NutritionDaily.tenant_id.in_(target_tenant_ids),
            NutritionDaily.date == ration_date
        )
        
        if meal_type:
            query = query.filter_by(meal_type=meal_type)
        
        rations = query.all()
        
        return jsonify({
            'date': ration_date.isoformat(),
            'rations': [r.to_dict() for r in rations]
        }), 200
        
    except Exception as e:
        db.session.rollback()
        import traceback
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500


@nutrition_bp.route('/rations', methods=['POST'])
@tenant_required
def record_rations():
    """Record consumption for a child"""
    db.session.rollback()
    
    try:
        user = TenantContext.get_current_user()
        data = request.get_json()
        
        child_id = data['child_id']
        child = None
        
        if is_multi_center_role(user):
            # Find child without tenant filter first
            child = Child.query.get(child_id)
            if child:
                # Verify access
                from models.tenant import Tenant
                from models.license import LicenseAdmin
                lic_admin = LicenseAdmin.query.filter_by(user_id=user.id).first()
                # Check if child's tenant belongs to license
                has_access = False
                if lic_admin:
                    tenant = Tenant.query.get(child.tenant_id)
                    if tenant and tenant.license_id == lic_admin.license_id:
                        has_access = True
                
                if not has_access:
                     return jsonify({'error': 'No tienes acceso a este niño'}), 403
        else:
            child = Child.query.filter_by(id=child_id, tenant_id=user.tenant_id).first()

        if not child:
            return jsonify({'error': 'Niño no encontrado'}), 404
        
        ration_date = date.fromisoformat(data['date']) if data.get('date') else date.today()
        
        # Find existing or create new
        ration = NutritionDaily.query.filter_by(
            child_id=data['child_id'],
            date=ration_date,
            meal_type=data['meal_type']
        ).first()
        
        if not ration:
            ration = NutritionDaily(
                tenant_id=child.tenant_id,
                child_id=data['child_id'],
                date=ration_date,
                meal_type=data['meal_type']
            )
            db.session.add(ration)
        
        # Map quantity to consumption level
        qty = data.get('quantity', 100)
        if qty >= 90:
            ration.consumption_level = 'todo'
        elif qty >= 65:
            ration.consumption_level = 'la_mayoria'
        elif qty >= 40:
            ration.consumption_level = 'la_mitad'
        elif qty > 0:
            ration.consumption_level = 'poco'
        else:
            ration.consumption_level = 'nada'
        
        ration.menu_description = data.get('menu_description')
        ration.notes = data.get('notes')
        ration.registered_by_id = user.id
        
        db.session.commit()
        
        return jsonify({
            'message': 'Consumo registrado',
            'ration': ration.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        import traceback
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500


@nutrition_bp.route('/rations/bulk', methods=['POST'])
@tenant_required
def record_bulk_rations():
    """Record consumption for multiple children at once"""
    db.session.rollback()
    
    try:
        user = TenantContext.get_current_user()
        data = request.get_json()
        ration_date = date.fromisoformat(data['date']) if data.get('date') else date.today()
        meal_type = data['meal_type']
        rations_data = data['rations']  # [{child_id, quantity, notes}, ...]
        
        recorded = []
        
        for r in rations_data:
            if is_multi_center_role(user):
                child = Child.query.get(r['child_id'])
                if child:
                     # Verify access (lite version for bulk)
                     from models.tenant import Tenant
                     from models.license import LicenseAdmin
                     # Optimization: cache allowed tenant ids if needed, but for now query
                     lic_admin = LicenseAdmin.query.filter_by(user_id=user.id).first()
                     if not lic_admin: continue
                     
                     # Check if child's tenant matches license
                     # We join to be faster? Or just get tenant
                     tenant = Tenant.query.get(child.tenant_id)
                     if not tenant or tenant.license_id != lic_admin.license_id:
                         continue
            else:
                child = Child.query.filter_by(id=r['child_id'], tenant_id=user.tenant_id).first()

            if not child:
                continue
            
            # Find existing or create
            ration = NutritionDaily.query.filter_by(
                child_id=r['child_id'],
                date=ration_date,
                meal_type=meal_type
            ).first()
            
            if not ration:
                ration = NutritionDaily(
                    tenant_id=child.tenant_id,
                    child_id=r['child_id'],
                    date=ration_date,
                    meal_type=meal_type
                )
                db.session.add(ration)
            
            qty = r.get('quantity', 100)
            if qty >= 90:
                ration.consumption_level = 'todo'
            elif qty >= 65:
                ration.consumption_level = 'la_mayoria'
            elif qty >= 40:
                ration.consumption_level = 'la_mitad'
            elif qty > 0:
                ration.consumption_level = 'poco'
            else:
                ration.consumption_level = 'nada'
            
            ration.notes = r.get('notes')
            ration.registered_by_id = user.id
            recorded.append(ration)
        
        db.session.commit()
        
        return jsonify({
            'message': f'{len(recorded)} registros guardados',
            'count': len(recorded)
        }), 200
        
    except Exception as e:
        db.session.rollback()
        import traceback
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500


@nutrition_bp.route('/child/<int:child_id>/report', methods=['GET'])
@tenant_required
def get_child_nutrition_report( child_id):
    """Get nutrition report for a child"""
    db.session.rollback()
    
    try:
        user = TenantContext.get_current_user()
        if is_multi_center_role(user):
            child = Child.query.get(child_id)
            if child:
                from models.tenant import Tenant
                from models.license import LicenseAdmin
                lic_admin = LicenseAdmin.query.filter_by(user_id=user.id).first()
                if lic_admin:
                    tenant = Tenant.query.get(child.tenant_id)
                    if not tenant or tenant.license_id != lic_admin.license_id:
                        return jsonify({'error': 'No tienes acceso a este niño'}), 403
                else:
                    return jsonify({'error': 'Licencia no encontrada'}), 403
        else:
            child = Child.query.filter_by(id=child_id, tenant_id=user.tenant_id).first()

        if not child:
            return jsonify({'error': 'Niño no encontrado'}), 404
        
        # Get last 30 days
        start_date = date.today() - timedelta(days=30)
        
        rations = NutritionDaily.query.filter(
            NutritionDaily.child_id == child_id,
            NutritionDaily.date >= start_date
        ).all()
        
        # Calculate averages by meal type
        meal_stats = {}
        for meal in ['desayuno', 'almuerzo', 'refrigerio_am', 'refrigerio_pm']:
            meal_rations = [r for r in rations if r.meal_type == meal]
            if meal_rations:
                avg = sum(r.consumption_percentage for r in meal_rations) / len(meal_rations)
                meal_stats[meal] = {
                    'average': round(avg),
                    'count': len(meal_rations)
                }
        
        # Overall average
        overall_avg = sum(r.consumption_percentage for r in rations) / len(rations) if rations else 0
        
        return jsonify({
            'child_id': child_id,
            'child_name': child.full_name,
            'period': f'{start_date.isoformat()} - {date.today().isoformat()}',
            'overall_average': round(overall_avg),
            'meal_stats': meal_stats,
            'total_records': len(rations)
        }), 200
        
    except Exception as e:
        db.session.rollback()
        import traceback
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500


@nutrition_bp.route('/alerts', methods=['GET'])
@tenant_required
def get_nutrition_alerts():
    """Get nutrition alerts"""
    db.session.rollback()
    
    try:
        user = TenantContext.get_current_user()
        # Get children with low average consumption in last 7 days
        start_date = date.today() - timedelta(days=7)
        
        if is_multi_center_role(user):
            from models.license import LicenseAdmin
            from models.tenant import Tenant
            lic_admin = LicenseAdmin.query.filter_by(user_id=user.id).first()
            if lic_admin:
                children = Child.query.join(Tenant).filter(
                    Tenant.license_id == lic_admin.license_id,
                    Child.status == 'activo'
                ).order_by(Child.last_name.asc(), Child.first_name.asc()).all()
            else:
                children = []
        elif user.role.name in ['educadora', 'educator']:
            children = Child.query.filter_by(
                tenant_id=user.tenant_id,
                assigned_educator_id=user.id,
                status='activo'
            ).order_by(Child.last_name.asc(), Child.first_name.asc()).all()
        else:
            children = Child.query.filter_by(tenant_id=user.tenant_id, status='activo').order_by(Child.last_name.asc(), Child.first_name.asc()).all()
        
        alerts = []
        
        for child in children:
            rations = NutritionDaily.query.filter(
                NutritionDaily.child_id == child.id,
                NutritionDaily.date >= start_date
            ).all()
            
            if rations:
                avg = sum(r.consumption_percentage for r in rations) / len(rations)
                
                if avg < 50:
                    alerts.append({
                        'child_id': child.id,
                        'child_name': child.full_name,
                        'average_consumption': round(avg),
                        'records_count': len(rations),
                        'alert_type': 'bajo_consumo',
                        'severity': 'alta' if avg < 25 else 'media'
                    })
        
        # Sort by severity
        alerts.sort(key=lambda x: x['average_consumption'])
        
        return jsonify({
            'alerts': alerts,
            'total_alerts': len(alerts)
        }), 200
        
    except Exception as e:
        db.session.rollback()
        import traceback
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500


# ========================
# NUTRITION RECORDS EDIT/DELETE
# ========================

@nutrition_bp.route('/rations/<int:ration_id>', methods=['GET'])
@tenant_required
def get_ration(ration_id):
    """Get a specific nutrition record"""
    db.session.rollback()
    user = TenantContext.get_current_user()
    
    try:
        ration = NutritionDaily.query.get(ration_id)
        
        if not ration:
            return jsonify({'error': 'Registro no encontrado'}), 404
        
        # Permission check
        if not is_multi_center_role(user):
            if ration.tenant_id != user.tenant_id:
                return jsonify({'error': 'No tienes acceso'}), 403
        
        child = Child.query.get(ration.child_id)
        data = ration.to_dict()
        data['child_name'] = child.full_name if child else 'Desconocido'
        
        return jsonify({'ration': data}), 200
        
    except Exception as e:
        import traceback
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500


@nutrition_bp.route('/rations/<int:ration_id>', methods=['PUT'])
@tenant_required
def update_ration(ration_id):
    """Update a nutrition record"""
    db.session.rollback()
    user = TenantContext.get_current_user()
    
    try:
        ration = NutritionDaily.query.get(ration_id)
        
        if not ration:
            return jsonify({'error': 'Registro no encontrado'}), 404
        
        # Permission check
        if not is_multi_center_role(user):
            if ration.tenant_id != user.tenant_id:
                return jsonify({'error': 'No tienes acceso'}), 403
        
        data = request.get_json()
        
        # Update quantity/consumption level
        if 'quantity' in data:
            qty = data['quantity']
            if qty >= 90:
                ration.consumption_level = 'todo'
            elif qty >= 65:
                ration.consumption_level = 'la_mayoria'
            elif qty >= 40:
                ration.consumption_level = 'la_mitad'
            elif qty > 0:
                ration.consumption_level = 'poco'
            else:
                ration.consumption_level = 'nada'
        
        if 'consumption_level' in data:
            ration.consumption_level = data['consumption_level']
        
        for field in ['notes', 'menu_description', 'meal_type']:
            if field in data:
                setattr(ration, field, data[field])
        
        db.session.commit()
        
        return jsonify({
            'message': 'Registro actualizado',
            'ration': ration.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        import traceback
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500


@nutrition_bp.route('/rations/<int:ration_id>', methods=['DELETE'])
@tenant_required
def delete_ration(ration_id):
    """Delete a nutrition record"""
    db.session.rollback()
    user = TenantContext.get_current_user()
    
    try:
        ration = NutritionDaily.query.get(ration_id)
        
        if not ration:
            return jsonify({'error': 'Registro no encontrado'}), 404
        
        # Permission check
        if not is_multi_center_role(user):
            if ration.tenant_id != user.tenant_id:
                return jsonify({'error': 'No tienes acceso'}), 403
        
        db.session.delete(ration)
        db.session.commit()
        
        return jsonify({'message': 'Registro eliminado'}), 200
        
    except Exception as e:
        db.session.rollback()
        import traceback
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500


# =========================================================================
# NUTRITIONAL ASSESSMENTS / HISTORICAL ANALYSIS ENDPOINTS
# =========================================================================

@nutrition_bp.route('/assessments', methods=['GET'])
@tenant_required
def get_nutritional_assessments():
    """Get nutritional assessments / growth analysis history with search and professional filtering"""
    db.session.rollback()
    try:
        user = TenantContext.get_current_user()
        limit = request.args.get('limit', 200, type=int)
        search = request.args.get('search', '', type=str).strip()
        requested_tenant_id = request.args.get('tenant_id', type=int)

        target_tenant_ids = []
        from utils.role_helpers import is_multi_center_role, get_license_id_for_user
        if is_multi_center_role(user):
            from models.tenant import Tenant
            license_id = get_license_id_for_user(user)
            if license_id:
                all_tenants = Tenant.query.filter_by(license_id=license_id, is_active=True).all()
                allowed_ids = [t.id for t in all_tenants]
                if requested_tenant_id:
                    if requested_tenant_id in allowed_ids:
                        target_tenant_ids = [requested_tenant_id]
                    else:
                        return jsonify({'error': 'Acceso denegado'}), 403
                else:
                    target_tenant_ids = allowed_ids
        elif user.tenant_id:
            target_tenant_ids = [user.tenant_id]

        if not target_tenant_ids:
            return jsonify({'records': [], 'nutritionists': []}), 200

        records = []
        seen_keys = set()
        nutritionists_set = set()

        # 1. Query ChildNutritionalAssessment
        cna_query = db.session.query(ChildNutritionalAssessment)\
            .join(Child, ChildNutritionalAssessment.child_id == Child.id)\
            .outerjoin(User, ChildNutritionalAssessment.assessor_id == User.id)\
            .filter(ChildNutritionalAssessment.tenant_id.in_(target_tenant_ids))

        if search:
            search_pattern = f"%{search}%"
            full_user_name = User.first_name + " " + User.last_name
            full_child_name = Child.first_name + " " + Child.last_name
            full_child_name_inv = Child.last_name + " " + Child.first_name
            cna_query = cna_query.filter(
                or_(
                    Child.first_name.ilike(search_pattern),
                    Child.last_name.ilike(search_pattern),
                    full_child_name.ilike(search_pattern),
                    full_child_name_inv.ilike(search_pattern),
                    Child.cedula.ilike(search_pattern),
                    User.first_name.ilike(search_pattern),
                    User.last_name.ilike(search_pattern),
                    full_user_name.ilike(search_pattern),
                    ChildNutritionalAssessment.nutritional_diagnosis.ilike(search_pattern),
                    ChildNutritionalAssessment.observations.ilike(search_pattern)
                )
            )

        cnas = cna_query.order_by(ChildNutritionalAssessment.assessment_date.desc()).limit(limit).all()
        for cna in cnas:
            child = cna.child
            if not child:
                continue
            key = (cna.child_id, cna.assessment_date)
            seen_keys.add(key)
            prof_name = cna.assessor.full_name if cna.assessor else 'Nutricionista'
            if prof_name and prof_name != 'Sistema':
                nutritionists_set.add(prof_name)
            
            diag = cna.nutritional_diagnosis or cna.weight_for_age_diag or 'Sin evaluación'
            sem = cna.semaphore or ('VERDE' if 'Adecuado' in diag else 'AMARILLO')
            
            records.append({
                'id': cna.id,
                'source': 'cna',
                'child_id': child.id,
                'child_name': child.full_name,
                'child_cedula': child.cedula,
                'date': cna.assessment_date.isoformat() if cna.assessment_date else '',
                'assessment_date': cna.assessment_date.isoformat() if cna.assessment_date else '',
                'weight_kg': float(cna.weight_kg) if cna.weight_kg is not None else None,
                'height_cm': float(cna.height_cm) if cna.height_cm is not None else None,
                'z_score_weight': float(cna.z_weight_for_age) if cna.z_weight_for_age is not None else None,
                'z_score_height': float(cna.z_height_for_age) if cna.z_height_for_age is not None else None,
                'brachial_perimeter_cm': float(cna.brachial_perimeter_cm) if cna.brachial_perimeter_cm is not None else None,
                'hemoglobin_g_dl': float(cna.hemoglobin_g_dl) if cna.hemoglobin_g_dl is not None else None,
                'cephalic_perimeter_cm': float(cna.cephalic_perimeter_cm) if cna.cephalic_perimeter_cm is not None else None,
                'nutritional_diagnosis': diag,
                'semaphore': sem,
                'professional': prof_name,
                'notes': cna.observations or ''
            })

        # 2. Also incorporate HealthRecord (record_type='crecimiento') - containing the anthropometric assessments
        hr_query = db.session.query(HealthRecord)\
            .join(Child, HealthRecord.child_id == Child.id)\
            .outerjoin(User, HealthRecord.registered_by_id == User.id)\
            .filter(HealthRecord.tenant_id.in_(target_tenant_ids), HealthRecord.record_type == 'crecimiento')

        if search:
            search_pattern = f"%{search}%"
            full_user_name = User.first_name + " " + User.last_name
            full_child_name = Child.first_name + " " + Child.last_name
            full_child_name_inv = Child.last_name + " " + Child.first_name
            hr_query = hr_query.filter(
                or_(
                    Child.first_name.ilike(search_pattern),
                    Child.last_name.ilike(search_pattern),
                    full_child_name.ilike(search_pattern),
                    full_child_name_inv.ilike(search_pattern),
                    Child.cedula.ilike(search_pattern),
                    HealthRecord.medical_professional.ilike(search_pattern),
                    User.first_name.ilike(search_pattern),
                    User.last_name.ilike(search_pattern),
                    full_user_name.ilike(search_pattern),
                    HealthRecord.notes.ilike(search_pattern)
                )
            )

        hrs = hr_query.order_by(HealthRecord.record_date.desc()).limit(limit).all()
        for hr in hrs:
            key = (hr.child_id, hr.record_date)
            if key in seen_keys:
                continue
            child = Child.query.get(hr.child_id)
            if not child:
                continue
            
            z_w = float(hr.z_score_weight) if hr.z_score_weight is not None else None
            z_h = float(hr.z_score_height) if hr.z_score_height is not None else None
            status = WHOStandardsService.classify_weight_status(z_w)
            
            # Determine semaphore
            if 'Severa' in status or 'Obesidad' in status:
                sem = 'ROJO'
            elif 'Moderada' in status or 'Sobrepeso' in status:
                sem = 'NARANJA'
            elif 'Riesgo' in status:
                sem = 'AMARILLO'
            elif 'Adecuado' in status or 'Eutrófico' in status:
                sem = 'VERDE'
            else:
                sem = 'VERDE'
                
            prof_name = hr.medical_professional or (hr.registered_by.full_name if hr.registered_by else 'Nutricionista / Médico')
            if prof_name and prof_name != 'Sistema':
                nutritionists_set.add(prof_name)

            records.append({
                'id': hr.id,
                'source': 'health_record',
                'child_id': child.id,
                'child_name': child.full_name,
                'child_cedula': child.cedula,
                'date': hr.record_date.isoformat() if hr.record_date else '',
                'assessment_date': hr.record_date.isoformat() if hr.record_date else '',
                'weight_kg': float(hr.weight) if hr.weight is not None else None,
                'height_cm': float(hr.height) if hr.height is not None else None,
                'z_score_weight': z_w,
                'z_score_height': z_h,
                'cephalic_perimeter_cm': float(hr.head_circumference) if hr.head_circumference is not None else None,
                'nutritional_diagnosis': status,
                'semaphore': sem,
                'professional': prof_name,
                'notes': hr.notes or ''
            })

        return jsonify({
            'records': records,
            'nutritionists': sorted(list(nutritionists_set)),
            'count': len(records)
        }), 200

    except Exception as e:
        db.session.rollback()
        import traceback
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500


@nutrition_bp.route('/assessments', methods=['POST'])
@tenant_required
def create_nutritional_assessment():
    """Create a new nutritional / anthropometric assessment"""
    db.session.rollback()
    try:
        user = TenantContext.get_current_user()
        data = request.get_json() or {}
        
        child_id = data.get('child_id')
        if not child_id:
            return jsonify({'error': 'child_id es requerido'}), 400
            
        child = Child.query.get(child_id)
        if not child:
            return jsonify({'error': 'Niño no encontrado'}), 404
            
        tenant_id = child.tenant_id or user.tenant_id
        assess_date_str = data.get('assessment_date') or data.get('date')
        assess_date = date.fromisoformat(assess_date_str) if assess_date_str else date.today()
        
        weight_kg = float(data.get('weight_kg') or data.get('weight') or 0)
        height_cm = float(data.get('height_cm') or data.get('height') or 0)
        
        if weight_kg <= 0 or height_cm <= 0:
            return jsonify({'error': 'Peso y talla deben ser mayores a cero'}), 400
            
        # Calculate age in months
        age_months = child.age_months
        gender = child.gender or 'M'
        
        # Calculate Z-scores via WHOStandardsService
        z_w = WHOStandardsService.calculate_weight_for_age(weight_kg, age_months, gender)
        z_h = WHOStandardsService.calculate_height_for_age(height_cm, age_months, gender)
        
        diag_w = WHOStandardsService.classify_weight_status(z_w)
        diag_h = WHOStandardsService.classify_height_status(z_h)
        
        if 'Severa' in diag_w or 'Obesidad' in diag_w:
            sem = 'ROJO'
        elif 'Moderada' in diag_w or 'Sobrepeso' in diag_w:
            sem = 'NARANJA'
        elif 'Riesgo' in diag_w or 'Baja' in diag_h:
            sem = 'AMARILLO'
        else:
            sem = 'VERDE'

        cna = ChildNutritionalAssessment(
            tenant_id=tenant_id,
            child_id=child.id,
            assessor_id=user.id,
            assessment_date=assess_date,
            period_type=data.get('period_type', 'trimestral'),
            weight_kg=weight_kg,
            height_cm=height_cm,
            measurement_position=data.get('measurement_position', 'De pie'),
            brachial_perimeter_cm=data.get('brachial_perimeter_cm'),
            hemoglobin_g_dl=data.get('hemoglobin_g_dl'),
            cephalic_perimeter_cm=data.get('cephalic_perimeter_cm'),
            age_months_calc=age_months,
            z_weight_for_age=z_w,
            weight_for_age_diag=diag_w,
            z_height_for_age=z_h,
            height_for_age_diag=diag_h,
            semaphore=sem,
            nutritional_diagnosis=data.get('nutritional_diagnosis') or diag_w,
            observations=data.get('notes') or data.get('observations')
        )
        db.session.add(cna)
        
        # Also create or sync HealthRecord (record_type='crecimiento') so medical and growth charts stay aligned
        hr = HealthRecord(
            tenant_id=tenant_id,
            child_id=child.id,
            registered_by_id=user.id,
            record_date=assess_date,
            record_type='crecimiento',
            weight=weight_kg,
            height=height_cm,
            head_circumference=data.get('cephalic_perimeter_cm'),
            z_score_weight=z_w,
            z_score_height=z_h,
            medical_professional=user.full_name,
            notes=data.get('notes') or f"Evaluación nutricional: {diag_w}"
        )
        db.session.add(hr)
        
        db.session.commit()
        return jsonify({
            'message': 'Evaluación nutricional registrada con éxito',
            'assessment': cna.to_dict()
        }), 201

    except Exception as e:
        db.session.rollback()
        import traceback
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500


@nutrition_bp.route('/assessments/<int:assessment_id>', methods=['DELETE'])
@tenant_required
def delete_nutritional_assessment(assessment_id):
    """Delete a nutritional assessment"""
    db.session.rollback()
    try:
        user = TenantContext.get_current_user()
        cna = ChildNutritionalAssessment.query.get(assessment_id)
        if cna:
            db.session.delete(cna)
            db.session.commit()
            return jsonify({'message': 'Evaluación nutricional eliminada'}), 200
            
        hr = HealthRecord.query.filter_by(id=assessment_id, record_type='crecimiento').first()
        if hr:
            db.session.delete(hr)
            db.session.commit()
            return jsonify({'message': 'Registro nutricional eliminado'}), 200
            
        return jsonify({'error': 'Registro no encontrado'}), 404
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

