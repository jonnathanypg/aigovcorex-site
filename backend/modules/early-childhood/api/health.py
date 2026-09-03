"""
Health API for KindiCoreAI
Handles medical profiles, growth records, vaccines, and health alerts
"""
from flask import Blueprint, request, jsonify
from models import db
from models.health import HealthRecord, MedicalProfile, Vaccine, VACCINE_SCHEDULE
from models.child import Child
from middleware.tenant_context import tenant_required, TenantContext
from datetime import date, timedelta
from decimal import Decimal
from sqlalchemy import or_
from services.who_standards import WHOStandardsService

health_bp = Blueprint('health', __name__, url_prefix='/health')


@health_bp.route('/child/<int:child_id>', methods=['GET'])
@tenant_required
def get_child_health(child_id):
    """Get complete health profile for a child"""
    db.session.rollback()
    user = TenantContext.get_current_user()
    
    try:
        # Resolve child access
        from utils.role_helpers import is_multi_center_role, get_license_id_for_user
        if is_multi_center_role(user):
            from models.tenant import Tenant
            license_id = get_license_id_for_user(user)
            if not license_id:
                return jsonify({'error': 'No license assigned'}), 403
            
            # Check via join if child is in a tenant of this license
            child = Child.query.join(Tenant).filter(
                Child.id == child_id,
                Tenant.license_id == license_id
            ).first()
        elif user.role.name in ['educadora', 'educator']:
            child = Child.query.filter_by(
                id=child_id, tenant_id=user.tenant_id, assigned_educator_id=user.id
            ).first()
        else:
            child = Child.query.filter_by(id=child_id, tenant_id=user.tenant_id).first()
            
        if not child:
            return jsonify({'error': 'Niño no encontrado o acceso denegado'}), 404
        
        # Get medical profile
        profile = MedicalProfile.query.filter_by(child_id=child_id).first()
        
        # Get latest growth record
        latest_growth = HealthRecord.query.filter_by(
            child_id=child_id,
            record_type='crecimiento'
        ).order_by(HealthRecord.record_date.desc()).first()
        
        # Get all vaccines
        vaccines = Vaccine.query.filter_by(child_id=child_id).order_by(
            Vaccine.date_applied.desc()
        ).all()
        
        # Get recent health records
        recent_records = HealthRecord.query.filter_by(child_id=child_id).order_by(
            HealthRecord.record_date.desc()
        ).limit(10).all()
        
        return jsonify({
            'child': {
                'id': child.id,
                'name': child.full_name,
                'age_months': child.age_months,
                'birth_date': child.birth_date.isoformat() if child.birth_date else None
            },
            'medical_profile': profile.to_dict() if profile else None,
            'latest_growth': latest_growth.to_dict() if latest_growth else None,
            'vaccines': [v.to_dict() for v in vaccines],
            'recent_records': [r.to_dict() for r in recent_records]
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ========================
# GROWTH HISTORY ENDPOINT
# ========================

@health_bp.route('/child/<int:child_id>/growth', methods=['GET'])
@tenant_required
def get_growth_history(child_id):
    """Get growth history for a child, for charting purposes"""
    db.session.rollback()
    user = TenantContext.get_current_user()
    
    try:
        # Resolve child access
        from utils.role_helpers import is_multi_center_role, get_license_id_for_user
        if is_multi_center_role(user):
            from models.tenant import Tenant
            license_id = get_license_id_for_user(user)
            if not license_id:
                return jsonify({'error': 'No license assigned'}), 403
            
            child = Child.query.join(Tenant).filter(
                Child.id == child_id,
                Tenant.license_id == license_id
            ).first()
        else:
            child = Child.query.filter_by(id=child_id, tenant_id=user.tenant_id).first()
            
        if not child:
            return jsonify({'error': 'Niño no encontrado o acceso denegado'}), 404
        
        # Get all growth records
        growth_records = HealthRecord.query.filter_by(
            child_id=child_id,
            record_type='crecimiento'
        ).order_by(HealthRecord.record_date.asc()).all()
        
        # Calculate age in months at each measurement
        from dateutil.relativedelta import relativedelta
        
        history = []
        previous_item = None
        has_updates = False
        
        for record in growth_records:
            age_at_record = None
            if child.birth_date and record.record_date:
                delta = relativedelta(record.record_date, child.birth_date)
                age_at_record = max(0, delta.years * 12 + delta.months)
            
            weight_val = float(record.weight) if record.weight else None
            height_val = float(record.height) if record.height else None
            
            # Recalculate z-scores if missing
            z_w = float(record.z_score_weight) if record.z_score_weight is not None else None
            z_h = float(record.z_score_height) if record.z_score_height is not None else None
            
            if age_at_record is not None:
                if z_w is None and weight_val:
                    z_w = WHOStandardsService.calculate_weight_zscore(weight_val, age_at_record, child.gender or 'M')
                    if z_w is not None:
                        record.z_score_weight = z_w
                        has_updates = True
                if z_h is None and height_val:
                    z_h = WHOStandardsService.calculate_height_zscore(height_val, age_at_record, child.gender or 'M')
                    if z_h is not None:
                        record.z_score_height = z_h
                        has_updates = True
            
            current_item = {
                'id': record.id,
                'date': record.record_date.isoformat() if record.record_date else None,
                'age_months': age_at_record,
                'weight': weight_val,
                'height': height_val,
                'head_circumference': float(record.head_circumference) if record.head_circumference else None,
                'z_score_weight': z_w,
                'z_score_height': z_h,
                'weight_status': WHOStandardsService.classify_weight_status(z_w),
                'height_status': WHOStandardsService.classify_height_status(z_h),
                'notes': record.notes
            }
            
            # Detect measurement anomalies
            anomalies = WHOStandardsService.detect_measurement_anomalies(current_item, previous_item)
            current_item['anomalies'] = anomalies
            current_item['has_anomaly'] = len(anomalies) > 0
            
            history.append(current_item)
            previous_item = current_item
        
        if has_updates:
            try:
                db.session.commit()
            except Exception:
                db.session.rollback()
        
        return jsonify({
            'child': {
                'id': child.id,
                'name': child.full_name,
                'gender': child.gender or 'M',
                'birth_date': child.birth_date.isoformat() if child.birth_date else None
            },
            'history': history,
            'total_measurements': len(history),
            'total_anomalies': sum(1 for h in history if h.get('has_anomaly'))
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@health_bp.route('/vaccines/pending', methods=['GET'])
@tenant_required
def get_pending_vaccines():
    """Get all pending/overdue vaccines for the tenant"""
    db.session.rollback()
    user = TenantContext.get_current_user()
    
    try:
        target_tenant_ids = []
        requested_tenant_id = request.args.get('tenant_id', type=int)
        
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
             return jsonify({'alerts': [], 'total_alerts': 0}), 200

        # Get all children in target tenants (educadora: solo asignados)
        children = Child.query.filter(
            Child.tenant_id.in_(target_tenant_ids), 
            Child.status == 'activo'
        ).all()
        if user.role.name in ['educadora', 'educator']:
            children = [c for c in children if c.assigned_educator_id == user.id]
        
        alerts = []
        
        for child in children:
            # Get pending vaccines
            pending = Vaccine.query.filter_by(
                child_id=child.id,
                status='pendiente'
            ).all()
            
            for vaccine in pending:
                if vaccine.is_overdue:
                    alerts.append({
                        'child_id': child.id,
                        'child_name': child.full_name,
                        'vaccine': vaccine.vaccine_name,
                        'dose': vaccine.dose_number,
                        'due_date': vaccine.next_dose_date.isoformat() if vaccine.next_dose_date else None,
                        'days_overdue': (date.today() - vaccine.next_dose_date).days if vaccine.next_dose_date else 0,
                        'severity': 'high' if vaccine.next_dose_date and (date.today() - vaccine.next_dose_date).days > 30 else 'medium'
                    })
        
        # Sort by days overdue
        alerts.sort(key=lambda x: x.get('days_overdue', 0), reverse=True)
        
        return jsonify({
            'alerts': alerts,
            'total_alerts': len(alerts)
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@health_bp.route('/activity', methods=['GET'])
@tenant_required
def get_recent_activity():
    """Get recent health activity for the tenant with optional search query"""
    db.session.rollback()
    
    try:
        user = TenantContext.get_current_user()
        limit = request.args.get('limit', 100, type=int)
        search = request.args.get('search', '', type=str).strip()
        
        target_tenant_ids = []
        requested_tenant_id = request.args.get('tenant_id', type=int)
        
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
             return jsonify({'records': []}), 200
        
        query = db.session.query(HealthRecord).join(Child, HealthRecord.child_id == Child.id).filter(
            HealthRecord.tenant_id.in_(target_tenant_ids)
        )
        
        if search:
            search_pattern = f"%{search}%"
            query = query.filter(
                or_(
                    Child.first_name.ilike(search_pattern),
                    Child.last_name.ilike(search_pattern),
                    Child.cedula.ilike(search_pattern),
                    HealthRecord.medical_professional.ilike(search_pattern),
                    HealthRecord.notes.ilike(search_pattern),
                    HealthRecord.incident_description.ilike(search_pattern),
                    HealthRecord.record_type.ilike(search_pattern)
                )
            )
        
        records = query.order_by(HealthRecord.record_date.desc()).limit(limit).all()
        
        result = []
        for r in records:
            child = Child.query.get(r.child_id)
            if not child:
                continue
                
            data = r.to_dict()
            data['child_name'] = child.full_name
            data['child_cedula'] = child.cedula
            # Map fields for frontend table
            data['type'] = r.record_type
            data['date'] = r.record_date.isoformat() if r.record_date else ''
            
            # Determine result/summary based on type
            if r.record_type == 'crecimiento':
                z_w = float(r.z_score_weight) if r.z_score_weight is not None else None
                z_h = float(r.z_score_height) if r.z_score_height is not None else None
                status = WHOStandardsService.classify_weight_status(z_w)
                data['result'] = f"Peso: {r.weight or 'N/A'}kg, Talla: {r.height or 'N/A'}cm ({status})"
            elif r.record_type == 'incidente':
                data['result'] = r.incident_description or 'Sin detalles'
            else:
                data['result'] = r.notes or 'N/A'
                
            data['professional'] = r.medical_professional or (r.registered_by.full_name if r.registered_by else 'Sistema')
            data['age_at_measurement'] = data.get('age_at_measurement')
            
            result.append(data)
            
        return jsonify({'records': result, 'count': len(result)}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@health_bp.route('/who-curves', methods=['GET'])
def get_who_curves():
    """Get WHO standard growth curves for chart rendering (0-24m and 24-60m)"""
    indicator = request.args.get('indicator', 'height') # 'height' or 'weight'
    gender = request.args.get('gender', 'M') # 'M' or 'F'
    min_age = request.args.get('min_age', 0, type=int)
    max_age = request.args.get('max_age', 60, type=int)
    
    curves = WHOStandardsService.get_reference_curves(indicator, gender, min_age, max_age)
    return jsonify({
        'indicator': indicator,
        'gender': 'M' if str(gender).upper().startswith(('M', 'H', 'B', 'N', 'V')) else 'F',
        'min_age': min_age,
        'max_age': max_age,
        'curves': curves
    }), 200


# ========================
# HEALTH RECORDS EDIT/DELETE
# ========================

@health_bp.route('/records/<int:record_id>', methods=['GET'])
@tenant_required
def get_health_record(record_id):
    """Get a specific health record"""
    db.session.rollback()
    
    try:
        user = TenantContext.get_current_user()
        record = HealthRecord.query.get(record_id)
        
        if not record:
            return jsonify({'error': 'Registro no encontrado'}), 404
        
        # Permission check
        from utils.role_helpers import is_multi_center_role
        if not is_multi_center_role(user):
            if record.tenant_id != user.tenant_id:
                return jsonify({'error': 'No tienes acceso'}), 403
        
        child = Child.query.get(record.child_id)
        data = record.to_dict()
        data['child_name'] = child.full_name if child else 'Desconocido'
        
        return jsonify({'record': data}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@health_bp.route('/records/<int:record_id>', methods=['PUT'])
@tenant_required
def update_health_record(record_id):
    """Update a health record"""
    db.session.rollback()
    
    try:
        user = TenantContext.get_current_user()
        record = HealthRecord.query.get(record_id)
        
        if not record:
            return jsonify({'error': 'Registro no encontrado'}), 404
        
        # Permission check
        from utils.role_helpers import is_multi_center_role
        if not is_multi_center_role(user):
            if record.tenant_id != user.tenant_id:
                return jsonify({'error': 'No tienes acceso'}), 403
        
        data = request.get_json()
        
        # Update allowed fields based on record type
        updatable_fields = ['notes', 'record_type', 'symptoms', 'diagnosis', 
                           'treatment', 'medication', 'medical_professional']
        
        # Growth-specific fields
        if record.record_type == 'crecimiento' or data.get('record_type') == 'crecimiento':
            updatable_fields.extend(['weight', 'height', 'head_circumference'])
        
        # Incident-specific fields
        if record.record_type == 'incidente' or data.get('record_type') == 'incidente':
            updatable_fields.extend(['incident_description', 'action_taken'])
        
        for field in updatable_fields:
            if field in data:
                value = data[field]
                # Handle Decimal conversion for numeric fields
                if field in ['weight', 'height', 'head_circumference'] and value:
                    value = Decimal(str(value))
                setattr(record, field, value)
        
        # Recalculate Z-scores if growth record
        if record.record_type == 'crecimiento':
            child = Child.query.get(record.child_id)
            if child and child.birth_date and record.record_date:
                from dateutil.relativedelta import relativedelta
                delta = relativedelta(record.record_date, child.birth_date)
                age_m = max(0, delta.years * 12 + delta.months)
                w_val = float(record.weight) if record.weight else None
                h_val = float(record.height) if record.height else None
                if w_val:
                    record.z_score_weight = WHOStandardsService.calculate_weight_zscore(w_val, age_m, child.gender or 'M')
                if h_val:
                    record.z_score_height = WHOStandardsService.calculate_height_zscore(h_val, age_m, child.gender or 'M')
        
        db.session.commit()
        
        return jsonify({
            'message': 'Registro actualizado exitosamente',
            'record': record.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@health_bp.route('/records/<int:record_id>', methods=['DELETE'])
@tenant_required
def delete_health_record(record_id):
    """Delete a health record"""
    db.session.rollback()
    
    try:
        user = TenantContext.get_current_user()
        record = HealthRecord.query.get(record_id)
        
        if not record:
            return jsonify({'error': 'Registro no encontrado'}), 404
        
        # Permission check
        from utils.role_helpers import is_multi_center_role
        if not is_multi_center_role(user):
            if record.tenant_id != user.tenant_id:
                return jsonify({'error': 'No tienes acceso'}), 403
        
        db.session.delete(record)
        db.session.commit()
        
        return jsonify({'message': 'Registro eliminado'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ========================
# RESTORED POST ENDPOINTS
# ========================

@health_bp.route('/child/<int:child_id>/growth', methods=['POST'])
@tenant_required
def record_growth(child_id):
    """Record growth measurement with automatic WHO Z-Score calculation"""
    db.session.rollback()
    
    try:
        user = TenantContext.get_current_user()
        child = Child.query.get(child_id)
        
        if not child:
            return jsonify({'error': 'Niño no encontrado'}), 404
            
        # Permission check
        from utils.role_helpers import is_multi_center_role
        if not is_multi_center_role(user):
            if child.tenant_id != user.tenant_id:
                return jsonify({'error': 'No tienes acceso'}), 403
        
        data = request.get_json()
        
        from datetime import datetime
        record_date_val = date.today()
        if data.get('record_date'):
            try:
                record_date_val = datetime.strptime(data.get('record_date'), '%Y-%m-%d').date()
            except ValueError:
                pass

        weight_input = data.get('weight')
        height_input = data.get('height')
        head_circ_input = data.get('head_circumference')

        # Calculate exact WHO Z-scores
        z_w = None
        z_h = None
        if child.birth_date and record_date_val:
            from dateutil.relativedelta import relativedelta
            delta = relativedelta(record_date_val, child.birth_date)
            age_months = max(0, delta.years * 12 + delta.months)
            
            if weight_input:
                try:
                    z_w = WHOStandardsService.calculate_weight_zscore(float(weight_input), age_months, child.gender or 'M')
                except Exception:
                    pass
            if height_input:
                try:
                    z_h = WHOStandardsService.calculate_height_zscore(float(height_input), age_months, child.gender or 'M')
                except Exception:
                    pass

        record = HealthRecord(
            tenant_id=child.tenant_id,
            child_id=child_id,
            record_date=record_date_val,
            record_type='crecimiento',
            weight=weight_input,
            height=height_input,
            head_circumference=head_circ_input,
            z_score_weight=z_w,
            z_score_height=z_h,
            notes=data.get('notes'),
            registered_by_id=user.id
        )
        
        db.session.add(record)
        db.session.commit()
        
        return jsonify({
            'message': 'Crecimiento registrado',
            'record': record.to_dict(),
            'weight_status': WHOStandardsService.classify_weight_status(z_w),
            'height_status': WHOStandardsService.classify_height_status(z_h)
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@health_bp.route('/child/<int:child_id>/record', methods=['POST'])
@tenant_required
def create_health_record(child_id):
    """Create generic health record (incident, illness, checkup) with WHO Z-Scores if metrics provided"""
    db.session.rollback()
    
    try:
        user = TenantContext.get_current_user()
        child = Child.query.get(child_id)
        
        if not child:
            return jsonify({'error': 'Niño no encontrado'}), 404
            
        # Permission check
        from utils.role_helpers import is_multi_center_role
        if not is_multi_center_role(user):
            if child.tenant_id != user.tenant_id:
                return jsonify({'error': 'No tienes acceso'}), 403
        
        data = request.get_json()
        
        from datetime import datetime
        record_date_val = date.today()
        if data.get('record_date'):
            try:
                record_date_val = datetime.strptime(data.get('record_date'), '%Y-%m-%d').date()
            except ValueError:
                pass
                
        weight_input = data.get('weight')
        height_input = data.get('height')
        head_circ_input = data.get('head_circumference')

        z_w = None
        z_h = None
        if child.birth_date and record_date_val and (weight_input or height_input):
            from dateutil.relativedelta import relativedelta
            delta = relativedelta(record_date_val, child.birth_date)
            age_months = max(0, delta.years * 12 + delta.months)
            
            if weight_input:
                try:
                    z_w = WHOStandardsService.calculate_weight_zscore(float(weight_input), age_months, child.gender or 'M')
                except Exception:
                    pass
            if height_input:
                try:
                    z_h = WHOStandardsService.calculate_height_zscore(float(height_input), age_months, child.gender or 'M')
                except Exception:
                    pass

        record = HealthRecord(
            tenant_id=child.tenant_id,
            child_id=child_id,
            record_date=record_date_val,
            record_type=data.get('record_type', 'incidente'),
            incident_description=data.get('incident_description'),
            symptoms=data.get('symptoms'),
            treatment=data.get('treatment'),
            medical_professional=data.get('medical_professional'),
            weight=weight_input,
            height=height_input,
            head_circumference=head_circ_input,
            z_score_weight=z_w,
            z_score_height=z_h,
            notes=data.get('notes'),
            registered_by_id=user.id
        )
        
        db.session.add(record)
        db.session.commit()
        
        return jsonify({
            'message': 'Registro de salud creado',
            'record': record.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@health_bp.route('/child/<int:child_id>/vaccine', methods=['POST'])
@tenant_required
def record_vaccine(child_id):
    """Record a vaccine application"""
    db.session.rollback()
    
    try:
        user = TenantContext.get_current_user()
        child = Child.query.get(child_id)
        
        if not child:
            return jsonify({'error': 'Niño no encontrado'}), 404
            
        # Permission check
        from utils.role_helpers import is_multi_center_role
        if not is_multi_center_role(user):
            if child.tenant_id != user.tenant_id:
                return jsonify({'error': 'No tienes acceso'}), 403
        
        data = request.get_json()
        
        vaccine = Vaccine(
            tenant_id=child.tenant_id,
            child_id=child_id,
            vaccine_name=data.get('vaccine_name'),
            vaccine_type=data.get('vaccine_type'),
            dose_number=data.get('dose_number', 1),
            date_applied=date.today(),
            applied_by=data.get('applied_by'),
            application_site=data.get('application_site'),
            batch_number=data.get('batch_number'),
            status='aplicada',
            registered_by_id=user.id,
            notes=data.get('notes')
        )
        
        db.session.add(vaccine)
        db.session.commit()
        
        return jsonify({
            'message': 'Vacuna registrada',
            'vaccine': vaccine.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
