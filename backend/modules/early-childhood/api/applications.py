from utils.role_helpers import is_multi_center_role
"""
Applications API - Gestión de Solicitudes de Ingreso
Accesible por usuarios autenticados del centro
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db
from models.user import User
from models.child import Child, Family, Representative
from models.application import Application, VulnerabilityForm, WaitingList
from models.document import Document
from datetime import datetime, date

applications_bp = Blueprint('applications', __name__, url_prefix='/applications')


def require_authenticated(f):
    """Decorator to require any authenticated user"""
    @jwt_required()
    def decorated_function(*args, **kwargs):
        user_id = int(get_jwt_identity())
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'Usuario no encontrado'}), 401

        # License Admin doesn't need a fixed tenant_id
        if not is_multi_center_role(user) and not user.tenant_id:
            return jsonify({'error': 'Usuario no asignado a ningún centro'}), 403
            
        return f(user, *args, **kwargs)
    
    decorated_function.__name__ = f.__name__
    return decorated_function


def get_authorized_application(user, application_id):
    """
    Helper to fetch application with security checks for License Admin vs Regular User
    """
    application = Application.query.get(application_id)
    if not application:
        return None
        
    if is_multi_center_role(user):
        from models.license import LicenseAdmin
        from models.tenant import Tenant
        
        # Verify admin has a license
        admin = LicenseAdmin.query.filter_by(user_id=user.id).first()
        if not admin:
            return None
            
        # Verify app's center belongs to admin's license
        # We can optimize this by checking if center_id is in admin's allowed list, 
        # but fetching the tenant is safer to ensure consistency
        tenant = Tenant.query.get(application.center_id)
        if not tenant or tenant.license_id != admin.license_id:
            return None
    else:
        # Regular user: must match tenant_id
        if application.center_id != user.tenant_id:
            return None
            
    return application


@applications_bp.route('/create', methods=['POST'])
@jwt_required()
def create_application():
    """
    Crear nueva solicitud de ingreso.
    - Regular Users: Uses user.tenant_id
    - License Admin: Uses tenant_id from body
    """
    try:
        db.session.rollback()  # Preventive rollback
        user_id = int(get_jwt_identity())
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'Usuario no encontrado'}), 403

        data = request.get_json()
        
        # Determine Tenant ID
        tenant_id = None
        if is_multi_center_role(user):
            tenant_id = data.get('tenant_id')
            if not tenant_id:
                return jsonify({'error': 'License Admin debe seleccionar un centro (tenant_id)'}), 400
        else:
            if not user.tenant_id:
                return jsonify({'error': 'Usuario no asignado a ningún centro'}), 403
            tenant_id = user.tenant_id
        
        # 1. Crear familia
        family = Family(
            tenant_id=tenant_id,
            address=data.get('family_address'),
            city=data.get('family_city'),
            province=data.get('family_province'),
            phone_primary=data.get('family_phone_primary'),
            phone_secondary=data.get('family_phone_secondary'),
            emergency_contact_name=data.get('emergency_contact_name'),
            emergency_contact_phone=data.get('emergency_contact_phone'),
            emergency_contact_relationship=data.get('emergency_contact_relationship'),
            # Datos geográficos expandidos
            sector=data.get('family_sector'),
            neighborhood=data.get('family_neighborhood'),
            residency_years=data.get('residency_years'),
            previous_address=data.get('previous_address'),
            previous_city=data.get('previous_city'),
            previous_province=data.get('previous_province'),
            # Perfil socioeconómico
            housing_type=data.get('housing_type'),
            employment_type=data.get('employment_type'),
            monthly_income_range=data.get('monthly_income_range'),
            household_type=data.get('household_type'),
            economic_condition=data.get('economic_condition'),
            geographic_zone=data.get('geographic_zone'),
            ethnic_identity=data.get('ethnic_identity'),
            has_disability=data.get('has_disability', False),
            disability_detail=data.get('disability_detail'),
            mobility_status=data.get('mobility_status', 'no_aplica'),
            migrant_origin=data.get('migrant_origin'),
            social_risks=data.get('social_risks', []),
        )
        db.session.add(family)
        db.session.flush()
        
        # 2. Crear representantes
        representatives_data = data.get('representatives', [])
        for rep_data in representatives_data:
            # Map relationship to valid enum value
            relationship = rep_data.get('relationship', 'otro').lower()
            valid_relationships = ['madre', 'padre', 'abuelo', 'abuela', 'tio', 'tia', 'tutor_legal', 'otro']
            if relationship not in valid_relationships:
                relationship = 'otro'
                
            representative = Representative(
                family_id=family.id,
                first_name=rep_data.get('first_name', ''),
                last_name=rep_data.get('last_name', ''),
                cedula=rep_data.get('cedula') if rep_data.get('cedula') else None,
                relationship=relationship,
                phone=rep_data.get('phone') if rep_data.get('phone') else None,
                email=rep_data.get('email') if rep_data.get('email') else None,
                occupation=rep_data.get('occupation'),
                workplace=rep_data.get('workplace'),
                is_primary=rep_data.get('is_primary', True),
                # Datos de origen
                birth_place=rep_data.get('birth_place'),
                birth_province=rep_data.get('birth_province'),
                nationality=rep_data.get('nationality', 'Ecuatoriana'),
            )
            db.session.add(representative)
        
        # 3. Crear Child con status 'lista_espera' (Option B: niño existe desde postulación)
        gender = data.get('child_gender', 'masculino').lower()
        if gender not in ['masculino', 'femenino']:
            gender = 'masculino'  # Default
            
        child_cedula = data.get('child_cedula') if data.get('child_cedula') else None
        if child_cedula:
            existing = Child.query.filter_by(cedula=child_cedula).first()
            if existing:
                return jsonify({'error': f'El niño con cédula {child_cedula} ya se encuentra registrado en la plataforma.'}), 400
                
        child = Child(
            tenant_id=tenant_id,
            family_id=family.id,
            first_name=data['child_first_name'],
            last_name=data['child_last_name'],
            birth_date=datetime.strptime(data['child_birth_date'], '%Y-%m-%d').date(),
            gender=gender,
            cedula=data.get('child_cedula') if data.get('child_cedula') else None,
            enrollment_date=date.today(),
            status='lista_espera'  # KEY: Niño en espera hasta aprobación
        )
        db.session.add(child)
        db.session.flush()
        
        # 4. Crear Application vinculada al Child
        application = Application(
            center_id=tenant_id,
            tenant_id=tenant_id, # Fix: Populate duplicated column
            child_id=child.id,  # Link to created Child
            application_date=date.today(),
            status='pending'
        )
        db.session.add(application)
        db.session.flush()
        
        # 5. Crear ficha de vulnerabilidad si se proporcionó
        if 'vulnerability' in data:
            vuln_data = data['vulnerability']
            vulnerability = VulnerabilityForm(
                child_id=child.id,
                application_id=application.id,
                evaluated_by=user.id,
                evaluation_date=date.today(),
                household_members=vuln_data.get('household_members'),
                monthly_income=vuln_data.get('monthly_income'),
                housing_type=vuln_data.get('housing_type'),
                single_parent=vuln_data.get('single_parent', False),
                teen_parent=vuln_data.get('teen_parent', False),
                disability_in_family=vuln_data.get('disability_in_family', False),
                chronic_illness=vuln_data.get('chronic_illness', False),
                violence_indicators=vuln_data.get('violence_indicators', False),
                unemployment=vuln_data.get('unemployment', False),
            )
            db.session.add(vulnerability)
            db.session.flush()
            
            # Calcular score automáticamente
            score = vulnerability.calculate_score()
            application.priority_score = score
        
        db.session.commit()
        
        return jsonify({
            'message': 'Solicitud creada exitosamente',
            'application': {
                'id': application.id,
                'child_id': child.id,
                'child_name': child.full_name,
                'priority_score': application.priority_score,
                'status': application.status
            }
        }), 201
        
    except Exception as e:
        db.session.rollback()
        import traceback
        print(f"Error creating application: {str(e)}")
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500


@applications_bp.route('/list', methods=['GET'])
@require_authenticated
def list_applications(user):
    """Listar solicitudes del centro"""
    try:
        status = request.args.get('status')
        search = request.args.get('search', '').strip()
        
        # License Admin Logic: Get all applications from all tenants under the license
        if is_multi_center_role(user):
            from models.license import LicenseAdmin
            from models.tenant import Tenant
            
            lic_admin = LicenseAdmin.query.filter_by(user_id=user.id).first()
            if not lic_admin:
                return jsonify({'applications': []}), 200
                
            # Get IDs of all active tenants under this license
            tenant_ids = [t.id for t in Tenant.query.filter_by(license_id=lic_admin.license_id, is_active=True).all()]
            
            # Filter by specific tenant if requested in query params
            requested_tenant_id = request.args.get('tenant_id', type=int)
            if requested_tenant_id:
                if requested_tenant_id in tenant_ids:
                    tenant_ids = [requested_tenant_id]
                else:
                    return jsonify({'error': 'Acceso denegado a este centro'}), 403
            
            query = Application.query.filter(Application.center_id.in_(tenant_ids))
        else:
            # Regular user logic
            query = Application.query.filter_by(center_id=user.tenant_id)
        
        if status:
            query = query.filter(Application.status == status)
        else:
            # Default: only show active applications (not approved or rejected)
            query = query.filter(Application.status.in_(['pending', 'waitlist']))
        
        # Search filter: by child name or cédula
        if search:
            query = query.join(Child, Application.child_id == Child.id).filter(
                db.or_(
                    Child.first_name.ilike(f'%{search}%'),
                    Child.last_name.ilike(f'%{search}%'),
                    Child.cedula.ilike(f'%{search}%'),
                    db.func.concat(Child.first_name, ' ', Child.last_name).ilike(f'%{search}%')
                )
            )
        
        applications = query.order_by(Application.priority_score.desc()).all()
        
        applications_list = []
        for app in applications:
            # Access child properties through the relationship
            child = app.child
            family = child.family if child else None
            
            # For apps without child, show a more descriptive message
            if child:
                child_name = child.full_name
                child_age = child.age_months
                child_cedula = child.cedula
            else:
                child_name = f"(Sin niño vinculado - App #{app.id})"
                child_age = None
                child_cedula = None
            
            # Get tenant name for context in global view
            tenant_name = app.center.name if app.center else "Desconocido"
            
            applications_list.append({
                'id': app.id,
                'child_name': child_name,
                'child_cedula': child_cedula,
                'child_age_months': child_age,
                'application_date': app.application_date.isoformat() if app.application_date else None,
                'status': app.status,
                'priority_score': app.priority_score,
                'family_phone': family.phone_primary if family else None,
                'center_name': tenant_name
            })
        
        return jsonify({'applications': applications_list}), 200
        
    except Exception as e:
        import traceback
        print(f"Error in list_applications: {str(e)}")
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500


@applications_bp.route('/<int:application_id>', methods=['GET'])
@require_authenticated
def get_application(user, application_id):
    """Obtener detalles de una solicitud"""
    try:
        application = get_authorized_application(user, application_id)
        
        if not application:
            return jsonify({'error': 'Solicitud no encontrada'}), 404
        
        # Obtener familia a través de child (Referencia Segura: application -> child -> family)
        child = application.child
        if not child:
            return jsonify({'error': 'Datos del niño/a no encontrados para esta solicitud'}), 404
        
        family = child.family
        if not family:
            return jsonify({'error': 'Datos familiares no encontrados para esta solicitud'}), 404
        
        representatives = Representative.query.filter_by(family_id=family.id).all()
        
        # Obtener ficha de vulnerabilidad
        vulnerability = VulnerabilityForm.query.filter_by(application_id=application.id).first()
        
        # Obtener documentos
        documents = Document.query.filter_by(application_id=application.id).all()
        
        return jsonify({
            'application': {
                **application.to_dict(),
                # Add detailed child fields the frontend expects
                'child_first_name': child.first_name,
                'child_last_name': child.last_name,
                'child_cedula': child.cedula,
                'child_birth_date': child.birth_date.isoformat() if child.birth_date else None,
                'child_gender': child.gender,
                'child_enrollment_date': child.enrollment_date.isoformat() if child.enrollment_date else None,
            },
            'family': {
                'address': family.address,
                'city': family.city,
                'province': family.province,
                'sector': family.sector,
                'neighborhood': family.neighborhood,
                'phone_primary': family.phone_primary,
                'phone_secondary': family.phone_secondary,
                'emergency_contact_name': family.emergency_contact_name,
                'emergency_contact_phone': family.emergency_contact_phone,
                'emergency_contact_relationship': family.emergency_contact_relationship,
                'residency_years': family.residency_years,
                'previous_address': family.previous_address,
                'previous_city': family.previous_city,
                'previous_province': family.previous_province,
                'housing_type': family.housing_type,
                'employment_type': family.employment_type,
                'monthly_income_range': family.monthly_income_range,
                'household_type': family.household_type,
                'economic_condition': family.economic_condition,
                'geographic_zone': family.geographic_zone,
                'ethnic_identity': family.ethnic_identity,
                'has_disability': family.has_disability,
                'disability_detail': family.disability_detail,
                'mobility_status': family.mobility_status,
                'migrant_origin': family.migrant_origin,
                'social_risks': family.social_risks
            },
            'representatives': [
                {
                    'id': rep.id,
                    'first_name': rep.first_name,
                    'last_name': rep.last_name,
                    'cedula': rep.cedula,
                    'relationship': rep.relationship,
                    'phone': rep.phone,
                    'email': rep.email,
                    'occupation': rep.occupation,
                    'workplace': rep.workplace,
                    'is_primary': rep.is_primary,
                    'birth_place': rep.birth_place,
                    'birth_province': rep.birth_province,
                    'nationality': rep.nationality
                } for rep in representatives
            ],
            'vulnerability': vulnerability.to_dict() if vulnerability else None,
            'documents': [doc.to_dict() for doc in documents] if documents else []
        }), 200
        
    except Exception as e:
        import traceback
        print(f"Error in get_application ID {application_id}: {str(e)}")
        print(traceback.format_exc())
        return jsonify({'error': f"Error interno: {str(e)}"}), 500


@applications_bp.route('/<int:application_id>/approve', methods=['POST'])
@require_authenticated
def approve_application(user, application_id):
    """
    Aprobar solicitud (Option B Flow).
    El Child ya existe con status 'lista_espera'. 
    Al aprobar, solo cambiamos status a 'activo'.
    """
    try:
        db.session.rollback()
        
        application = get_authorized_application(user, application_id)
        
        if not application:
            return jsonify({'error': 'Solicitud no encontrada'}), 404
        
        data = request.get_json() or {}
        notes = data.get('notes', '')
        
        # Option B: El niño ya existe, solo actualizar su status
        child = application.child
        if not child:
            return jsonify({'error': 'Niño no encontrado en la solicitud'}), 404
        
        # Cambiar status del niño a activo
        child.status = 'activo'
        child.enrollment_date = date.today()
        
        # Marcar application como aprobada
        application.status = 'approved'
        application.decision_date = date.today()
        application.decided_by = user.id
        application.decision_notes = notes
        
        # Actualizar conteo del centro
        tenant = user.tenant
        tenant.current_enrollment = Child.query.filter_by(
            tenant_id=tenant.id,
            status='activo'
        ).count() + 1  # +1 because commit hasn't happened yet
        
        db.session.commit()
        
        return jsonify({
            'message': 'Solicitud aprobada - Niño inscrito exitosamente',
            'child_id': child.id,
            'child_name': child.full_name
        }), 200
        
    except Exception as e:
        db.session.rollback()
        import traceback
        print(f"Error approving: {str(e)}")
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500


@applications_bp.route('/<int:application_id>/reject', methods=['POST'])
@require_authenticated
def reject_application(user, application_id):
    """Rechazar solicitud"""
    try:
        db.session.rollback()
        
        application = get_authorized_application(user, application_id)
        
        if not application:
            return jsonify({'error': 'Solicitud no encontrada'}), 404
        
        data = request.get_json()
        notes = data.get('notes', '')
        
        application.reject(user.id, notes)
        
        db.session.commit()
        
        return jsonify({'message': 'Solicitud rechazada'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@applications_bp.route('/<int:application_id>/waitlist', methods=['POST'])
@require_authenticated
def move_to_waitlist(user, application_id):
    """Mover solicitud a lista de espera"""
    try:
        db.session.rollback()
        
        application = get_authorized_application(user, application_id)
        
        if not application:
            return jsonify({'error': 'Solicitud no encontrada'}), 404
        
        # Cambiar estado de la aplicación
        application.status = 'waitlist'
        application.decision_date = date.today()
        application.decided_by = user.id
        
        db.session.commit()
        
        return jsonify({
            'message': 'Solicitud movida a lista de espera'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@applications_bp.route('/<int:application_id>', methods=['PUT'])
@require_authenticated
def update_application(user, application_id):
    """Actualizar solicitud existente"""
    try:
        db.session.rollback()
        
        application = get_authorized_application(user, application_id)
        
        if not application:
            return jsonify({'error': 'Solicitud no encontrada'}), 404
            
        data = request.get_json()
        
        # 1. Update Child
        child = application.child
        if child:
            child.first_name = data.get('child_first_name', child.first_name)
            child.last_name = data.get('child_last_name', child.last_name)
            child.birth_date = datetime.strptime(data['child_birth_date'], '%Y-%m-%d').date() if 'child_birth_date' in data else child.birth_date
            child.gender = data.get('child_gender', child.gender)
            child.cedula = data.get('child_cedula') if data.get('child_cedula') else None
        
        # 2. Update Family
        family = application.family
        if family:
            family.address = data.get('family_address', family.address)
            family.city = data.get('family_city', family.city)
            family.province = data.get('family_province', family.province)
            family.sector = data.get('family_sector', family.sector)
            family.neighborhood = data.get('family_neighborhood', family.neighborhood)
            family.phone_primary = data.get('family_phone_primary', family.phone_primary)
            family.residency_years = data.get('residency_years', family.residency_years)
            family.previous_address = data.get('previous_address', family.previous_address)
            family.previous_city = data.get('previous_city', family.previous_city)
            
            # Socioeconomic
            family.housing_type = data.get('housing_type', family.housing_type)
            family.employment_type = data.get('employment_type', family.employment_type)
            family.monthly_income_range = data.get('monthly_income_range', family.monthly_income_range)
            family.household_type = data.get('household_type', family.household_type)
            family.economic_condition = data.get('economic_condition', family.economic_condition)
            family.geographic_zone = data.get('geographic_zone', family.geographic_zone)
            family.ethnic_identity = data.get('ethnic_identity', family.ethnic_identity)
            family.has_disability = data.get('has_disability', family.has_disability)
            family.disability_detail = data.get('disability_detail', family.disability_detail)
            family.mobility_status = data.get('mobility_status', family.mobility_status)
            family.migrant_origin = data.get('migrant_origin', family.migrant_origin)
            family.social_risks = data.get('social_risks', family.social_risks)
            
        # 3. Update Representative (Primary)
        # Note: simplistic update for primary rep, could be more complex
        representatives_data = data.get('representatives', [])
        if representatives_data:
            rep_data = representatives_data[0] # Assume updating primary
            rep = Representative.query.filter_by(family_id=family.id, is_primary=True).first()
            if rep:
                rep.first_name = rep_data.get('first_name', rep.first_name)
                rep.last_name = rep_data.get('last_name', rep.last_name)
                rep.cedula = rep_data.get('cedula') if rep_data.get('cedula') else None
                rep.relationship = rep_data.get('relationship', rep.relationship)
                rep.phone = rep_data.get('phone') if rep_data.get('phone') else None
                rep.email = rep_data.get('email') if rep_data.get('email') else None
                rep.occupation = rep_data.get('occupation', rep.occupation)
                rep.birth_place = rep_data.get('birth_place', rep.birth_place)
                rep.birth_province = rep_data.get('birth_province', rep.birth_province)
                rep.nationality = rep_data.get('nationality', rep.nationality)
        
        db.session.commit()
        return jsonify({'message': 'Solicitud actualizada exitosamente'}), 200
        
    except Exception as e:
        db.session.rollback()
        import traceback
        print(f"Error updating application: {str(e)}")
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500


@applications_bp.route('/<int:application_id>', methods=['DELETE'])
@require_authenticated
def delete_application(user, application_id):
    """
    Eliminar solicitud con lógica selectiva:
    - Si fue APROBADA: Solo eliminar Application y sus deps directas.
      El Child y Family permanecen intactos en el Registro.
    - Si NO fue aprobada (pending/rejected/waitlist): Borrado completo
      incluyendo Child y Family temporales.
    """
    try:
        db.session.rollback()
        
        application = get_authorized_application(user, application_id)
        
        if not application:
            return jsonify({'error': 'Solicitud no encontrada'}), 404
        
        was_approved = application.status == 'approved'
        
        # 1. Siempre eliminar dependencias directas de Application
        WaitingList.query.filter_by(application_id=application.id).delete()
        VulnerabilityForm.query.filter_by(application_id=application.id).delete()
        Document.query.filter_by(application_id=application.id).delete()
        
        # 2. Guardar referencias antes de borrar Application
        child = application.child
        family = child.family if child else None
        
        # 3. Eliminar Application
        db.session.delete(application)
        
        # 4. Solo si NO fue aprobada, limpiar Child y Family temporales
        if not was_approved:
            if child:
                db.session.delete(child)
            if family:
                # Verificar que la familia no tenga otros hijos activos
                from models.child import Child as ChildModel
                other_children = ChildModel.query.filter(
                    ChildModel.family_id == family.id,
                    ChildModel.id != (child.id if child else 0)
                ).count()
                if other_children == 0:
                    db.session.delete(family)
            
        db.session.commit()
        
        msg = 'Solicitud eliminada exitosamente'
        if was_approved:
            msg += ' (datos del niño/a preservados en Registro)'
        
        return jsonify({'message': msg}), 200
        
    except Exception as e:
        db.session.rollback()
        import traceback
        import logging
        logging.error(f"Error deleting application {application_id}: {str(e)}")
        logging.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500


@applications_bp.route('/waitlist', methods=['GET'])
@require_authenticated
def get_waitlist(user):
    """Obtener lista de espera del centro"""
    try:
        waitlist = WaitingList.query.filter_by(
            center_id=user.tenant_id,
            status='waiting'
        ).order_by(WaitingList.position).all()
        
        waitlist_data = []
        for entry in waitlist:
            app = entry.application
            waitlist_data.append({
                'id': entry.id,
                'position': entry.position,
                'child_name': f"{app.child_first_name} {app.child_last_name}",
                'priority_score': app.priority_score,
                'added_date': entry.added_date.isoformat() if entry.added_date else None,
                'application_id': app.id
            })
        
        return jsonify({'waitlist': waitlist_data}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
