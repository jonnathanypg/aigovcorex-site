from utils.role_helpers import is_multi_center_role
"""
Nutrition API for KindiCoreAI
Handles menu planning, daily consumption tracking, and nutrition alerts
"""
from flask import Blueprint, request, jsonify
from models import db
from models.nutrition import NutritionDaily, Menu, NutritionAlert
from models.child import Child
from models.attendance import Attendance
from middleware.tenant_context import tenant_required, TenantContext
from datetime import date, timedelta

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
        
        from models.tenant import Tenant
        from models.license import LicenseAdmin
        
        if is_multi_center_role(user):
            lic_admin = LicenseAdmin.query.filter_by(user_id=user.id).first()
            if lic_admin:
                target_license_id = lic_admin.license_id
                
            if 'tenant_id' in data and data['tenant_id']:
                target_tenant_id = data['tenant_id']
        elif user.tenant_id:
            target_tenant_id = user.tenant_id
            tenant = Tenant.query.get(user.tenant_id)
            if tenant:
                target_license_id = tenant.license_id
        
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
                ).all()
            else:
                children = []
        elif user.role.name in ['educadora', 'educator']:
            children = Child.query.filter_by(
                tenant_id=user.tenant_id,
                assigned_educator_id=user.id,
                status='activo'
            ).all()
        else:
            children = Child.query.filter_by(tenant_id=user.tenant_id, status='activo').all()
        
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
