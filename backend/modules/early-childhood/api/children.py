"""
Children API endpoints
"""
from flask import Blueprint, request, jsonify
from middleware.tenant_context import tenant_required, TenantContext
from auth.authorization import permission_required
from models import db
from models.child import Child, Family, Representative
from models.user import User
from models.tenant import Tenant
from datetime import datetime

children_bp = Blueprint('children', __name__, url_prefix='/children')


def _can_assign_educator(user):
    """Solo roles multicentro y coordinadoras pueden asignar educadora a un niño."""
    from utils.role_helpers import is_multi_center_role
    return is_multi_center_role(user) or user.role.name in ['center_coordinator', 'coordinator']


@children_bp.route('', methods=['GET'])
@tenant_required
def get_children():
    """
    Get all children.
    - Regular users: Restricted to their tenant_id
    - License Admin: Can filter by specific tenant_id or get all children in their license scope
    """
    try:
        current_user = TenantContext.get_current_user()
        
        # Determine scope
        from utils.role_helpers import is_multi_center_role, get_license_id_for_user
        if is_multi_center_role(current_user):
            # Universal roles logic
            from models.tenant import Tenant
            
            license_id = get_license_id_for_user(current_user)
            if not license_id:
                return jsonify({'error': 'No license assigned'}), 403
                
            requested_tenant_id = request.args.get('tenant_id')
            
            # Base query: join Children with Tenant to filter by License
            query = Child.query.join(Tenant).filter(Tenant.license_id == license_id)
            
            # Apply specific tenant filter if requested
            if requested_tenant_id and requested_tenant_id != 'all':
                query = query.filter(Child.tenant_id == requested_tenant_id)
                
        elif current_user.role.name in ['educadora', 'educator']:
            # Educator: only children assigned to them
            tenant_id = TenantContext.get_current_tenant_id()
            query = Child.query.filter_by(
                tenant_id=tenant_id,
                assigned_educator_id=current_user.id
            )
        else:
            # Coordinator or other center role: full center
            tenant_id = TenantContext.get_current_tenant_id()
            query = Child.query.filter_by(tenant_id=tenant_id)
        
        # Apply standard filters
        status = request.args.get('status', 'activo')
        search = request.args.get('search', '')
        
        if status and status != 'all':
            query = query.filter(Child.status == status)
        
        if search:
            query = query.filter(
                db.or_(
                    Child.first_name.ilike(f'%{search}%'),
                    Child.last_name.ilike(f'%{search}%'),
                    Child.cedula.ilike(f'%{search}%'),
                    db.func.concat(Child.first_name, ' ', Child.last_name).ilike(f'%{search}%')
                )
            )
        
        children = query.all()
        
        return jsonify({
            'children': [child.to_dict() for child in children],
            'total': len(children)
        }), 200
        
    except Exception as e:
        import traceback
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500


@children_bp.route('/educators', methods=['GET'])
@tenant_required
def get_center_educators():
    """
    Lista educadoras del centro con cupo de asignación.
    tenant_id: obligatorio para license_admin; para otros se usa el del contexto.
    Devuelve: id, full_name, assigned_count, max_per_educator, has_quota.
    """
    try:
        current_user = TenantContext.get_current_user()
        from models.license import LicenseAdmin
        from models.tenant import Tenant

        requested_tenant_id = request.args.get('tenant_id')
        from utils.role_helpers import is_multi_center_role, get_license_id_for_user
        if is_multi_center_role(current_user):
            license_id = get_license_id_for_user(current_user)
            if not license_id:
                return jsonify({'error': 'No license assigned'}), 403
            if not requested_tenant_id:
                return jsonify({'error': 'tenant_id requerido'}), 400
            tenant = Tenant.query.filter_by(
                id=int(requested_tenant_id),
                license_id=license_id
            ).first()
        else:
            tenant_id = TenantContext.get_current_tenant_id()
            if requested_tenant_id and int(requested_tenant_id) != tenant_id:
                return jsonify({'error': 'No puede consultar otro centro'}), 403
            tenant = Tenant.query.get(tenant_id)

        if not tenant:
            return jsonify({'error': 'Centro no encontrado'}), 404

        from models.user import Role
        role_ids = [r.id for r in Role.query.filter(Role.name.in_(['educadora', 'educator'])).all()]
        educators = User.query.filter(
            User.tenant_id == tenant.id,
            User.role_id.in_(role_ids),
            User.is_active == True
        ).all()

        max_per = getattr(tenant, 'max_children_per_educator', 10) or 10
        result = []
        for u in educators:
            assigned = Child.query.filter_by(
                tenant_id=tenant.id,
                assigned_educator_id=u.id,
                status='activo'
            ).count()
            result.append({
                'id': u.id,
                'full_name': u.full_name,
                'first_name': u.first_name,
                'last_name': u.last_name,
                'assigned_count': assigned,
                'max_per_educator': max_per,
                'has_quota': assigned < max_per,
            })
        return jsonify({'educators': result, 'max_children_per_educator': max_per}), 200
    except Exception as e:
        import traceback
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500


@children_bp.route('/<int:child_id>', methods=['GET'])
@tenant_required
def get_child(child_id):
    """Get specific child with full family details"""
    try:
        current_user = TenantContext.get_current_user()
        
        from utils.role_helpers import is_multi_center_role
        if is_multi_center_role(current_user):
            # License admin scope check (simplified)
            child = Child.query.get(child_id)
        elif current_user.role.name in ['educadora', 'educator']:
            # Educator: only if child is assigned to them
            tenant_id = TenantContext.get_current_tenant_id()
            child = Child.query.filter_by(
                id=child_id,
                tenant_id=tenant_id,
                assigned_educator_id=current_user.id
            ).first()
        elif current_user.role.name in ['educadora', 'educator']:
            tenant_id = TenantContext.get_current_tenant_id()
            child = Child.query.filter_by(
                id=child_id, tenant_id=tenant_id, assigned_educator_id=current_user.id
            ).first()
        else:
            tenant_id = TenantContext.get_current_tenant_id()
            child = Child.query.filter_by(id=child_id, tenant_id=tenant_id).first()
        
        if not child:
            return jsonify({'error': 'Niño no encontrado'}), 404
        
        # Build full response similar to application details
        family = child.family
        representatives = Representative.query.filter_by(family_id=family.id).all() if family else []
        
        response = {
            'child': child.to_dict(),
            'family': {},
            'representatives': []
        }
        
        if family:
            response['family'] = {
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
                # Socioeconomic
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
            }
            
            response['representatives'] = [{
                'id': r.id,
                'first_name': r.first_name,
                'last_name': r.last_name,
                'full_name': r.full_name,
                'cedula': r.cedula,
                'relationship': r.relationship,
                'phone': r.phone,
                'email': r.email,
                'occupation': r.occupation,
                'workplace': r.workplace,
                'is_primary': r.is_primary,
                'birth_place': r.birth_place,
                'birth_province': r.birth_province,
                'nationality': r.nationality
            } for r in representatives]
        
        return jsonify(response), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@children_bp.route('', methods=['POST'])
@tenant_required
def create_child():
    """
    Create new child with full family and representative data.
    - License Admin: Can specify 'tenant_id' in body.
    - Regular User: Uses current context 'tenant_id'.
    """
    try:
        db.session.rollback() # Preventive
        current_user = TenantContext.get_current_user()
        data = request.get_json()
        
        # 1. Determine Tenant ID
        tenant_id = None
        from utils.role_helpers import is_multi_center_role
        if is_multi_center_role(current_user):
            tenant_id = data.get('tenant_id')
            if not tenant_id:
                return jsonify({'error': 'Usuario multi-centro debe especificar tenant_id'}), 400
            # Verify license scope (optional but recommended)
        else:
            tenant_id = TenantContext.get_current_tenant_id()
        
        # Normalizar género: aceptar M/F además de masculino/femenino
        gender_raw = data.get('gender', 'masculino')
        gender_map = {'m': 'masculino', 'f': 'femenino', 'masculino': 'masculino', 'femenino': 'femenino'}
        gender = gender_map.get(gender_raw.lower().strip(), None)
        if not gender:
            return jsonify({'error': f'Género no válido: "{gender_raw}". Use masculino o femenino'}), 400
            
        # 2. Create Family (Address & Socioeconomic)
        # Check if family_id is provided (linking to existing family)
        family_id = data.get('family_id')
        
        if not family_id:
            family = Family(
                tenant_id=tenant_id,
                # Address
                address=data.get('family_address'),
                city=data.get('family_city'),
                province=data.get('family_province'),
                sector=data.get('family_sector'),
                neighborhood=data.get('family_neighborhood'),
                phone_primary=data.get('family_phone_primary'),
                phone_secondary=data.get('family_phone_secondary'),
                residency_years=data.get('residency_years'),
                previous_address=data.get('previous_address'),
                previous_city=data.get('previous_city'),
                # Socioeconomic
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
                emergency_contact_name=data.get('emergency_contact_name'),
                emergency_contact_phone=data.get('emergency_contact_phone'),
                emergency_contact_relationship=data.get('emergency_contact_relationship')
            )
            db.session.add(family)
            db.session.flush()
            family_id = family.id
            
            # 3. Create Representatives (if new family)
            representatives_data = data.get('representatives', [])
            for rep_data in representatives_data:
                # Map relationship
                relationship = rep_data.get('relationship', 'otro').lower()
                
                representative = Representative(
                    family_id=family.id,
                    first_name=rep_data.get('first_name', ''),
                    last_name=rep_data.get('last_name', ''),
                    cedula=rep_data.get('cedula') if rep_data.get('cedula') else None,
                    relationship=relationship,
                    phone=rep_data.get('phone'),
                    email=rep_data.get('email'),
                    occupation=rep_data.get('occupation'),
                    workplace=rep_data.get('workplace'),
                    # Origins
                    birth_place=rep_data.get('birth_place'),
                    birth_province=rep_data.get('birth_province'),
                    nationality=rep_data.get('nationality', 'Ecuatoriana'),
                    is_primary=rep_data.get('is_primary', False)
                )
                db.session.add(representative)
        
        # 4. Create Child
        # Parse birth_date safely
        birth_date_str = data.get('birth_date')
        if not birth_date_str:
             return jsonify({'error': 'Fecha de nacimiento es requerida'}), 400
        
        try:
            parsed_birth_date = datetime.strptime(birth_date_str, '%Y-%m-%d').date()
        except ValueError:
            return jsonify({'error': f'Formato de fecha inválido: "{birth_date_str}". Use YYYY-MM-DD'}), 400
             
        enrollment_date_str = data.get('enrollment_date', datetime.now().strftime('%Y-%m-%d'))
        
        assigned_educator_id = None
        if _can_assign_educator(current_user) and 'assigned_educator_id' in data and data['assigned_educator_id']:
            eid = data['assigned_educator_id']
            educator = User.query.filter_by(id=eid, tenant_id=tenant_id, is_active=True).first()
            if not educator:
                return jsonify({'error': 'Educadora no válida o no pertenece al centro'}), 400
            from models.user import Role
            if educator.role_id not in [r.id for r in Role.query.filter(Role.name.in_(['educadora', 'educator'])).all()]:
                return jsonify({'error': 'El usuario seleccionado no es educadora'}), 400
            tenant = Tenant.query.get(tenant_id)
            max_per = getattr(tenant, 'max_children_per_educator', 10) or 10
            count = Child.query.filter_by(tenant_id=tenant_id, assigned_educator_id=eid, status='activo').count()
            if count >= max_per:
                return jsonify({'error': f'La educadora ya tiene el máximo de niños asignados ({max_per})'}), 400
            assigned_educator_id = eid
        
        # Verificar cédula duplicada antes de intentar insertar
        cedula_val = data.get('cedula') if data.get('cedula') else None
        if cedula_val:
            existing_child = Child.query.filter_by(cedula=cedula_val).first()
            if existing_child:
                if existing_child.tenant_id == tenant_id:
                    status_text = {
                        'activo': 'Activo',
                        'inactivo': 'Inactivo',
                        'egresado': 'Egresado',
                        'lista_espera': 'Lista de Espera'
                    }.get(existing_child.status, existing_child.status)
                    
                    msg = f"El niño ya está registrado en este centro (Estado: {status_text}). "
                    if existing_child.status == 'activo' and not existing_child.assigned_educator_id:
                        msg += "Sin embargo, no tiene una educadora asignada, por lo que podría no aparecer en su padrón."
                    elif existing_child.status != 'activo':
                        msg += "Puede editar el registro existente o cambiar su estado desde la lista de niños usando el filtro correspondiente."
                else:
                    msg = "El niño ya se encuentra registrado en la plataforma en otro centro. Solicite un traslado."
                
                return jsonify({
                    'error': msg,
                    'existing_child_id': existing_child.id,
                    'existing_status': existing_child.status
                }), 400
        
        child = Child(
            tenant_id=tenant_id,
            family_id=family_id,
            first_name=data['first_name'],
            last_name=data['last_name'],
            birth_date=parsed_birth_date,
            gender=gender,
            enrollment_date=datetime.strptime(enrollment_date_str, '%Y-%m-%d').date(),
            cedula=cedula_val,
            blood_type=data.get('blood_type'),
            allergies=data.get('allergies'),
            medical_conditions=data.get('medical_conditions'),
            special_needs=data.get('special_needs'),
            assigned_group=data.get('assigned_group'),
            status=data.get('status', 'activo').lower(),
            assigned_educator_id=assigned_educator_id
        )
        
        db.session.add(child)
        db.session.commit()
        
        # Send email to assigned educator (non-blocking)
        if assigned_educator_id:
            try:
                from services.email_service import EmailService
                educator = User.query.get(assigned_educator_id)
                license_id = EmailService._get_license_id_from_tenant(tenant_id)
                if educator and license_id:
                    center_name = child.tenant.name if child.tenant else 'Centro'
                    html = EmailService.template_child_assigned(
                        educator_name=f"{educator.first_name} {educator.last_name}",
                        child_name=f"{child.first_name} {child.last_name}",
                        center_name=center_name
                    )
                    EmailService.send_email(license_id, educator.email, "Nueva Asignación de Niño/a", html)
            except Exception as email_err:
                import logging
                logging.getLogger(__name__).warning(f"Email to educator failed: {email_err}")
        
        return jsonify({
            'message': 'Niño registrado exitosamente',
            'child': child.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        import traceback
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500


@children_bp.route('/<int:child_id>', methods=['PUT'])
@tenant_required
def update_child(child_id):
    """Update child information. Educator can only update their assigned children."""
    try:
        db.session.rollback() # Preventive
        current_user = TenantContext.get_current_user()
        
        from utils.role_helpers import is_multi_center_role
        if is_multi_center_role(current_user):
            child = Child.query.get(child_id)
        elif current_user.role.name in ['educadora', 'educator']:
            tenant_id = TenantContext.get_current_tenant_id()
            child = Child.query.filter_by(
                id=child_id, tenant_id=tenant_id, assigned_educator_id=current_user.id
            ).first()
        else:
            tenant_id = TenantContext.get_current_tenant_id()
            child = Child.query.filter_by(id=child_id, tenant_id=tenant_id).first()
        
        if not child:
            return jsonify({'error': 'Niño no encontrado'}), 404
        
        # Educator/coordinator without manage_center can only edit their assigned children (already enforced above for educator)
        if current_user.role.name not in ['license_admin', 'supervisor', 'center_coordinator', 'coordinator'] and current_user.role.name not in ['educadora', 'educator']:
            if not current_user.has_permission('manage_center'):
                return jsonify({'error': 'Permiso denegado'}), 403
        
        data = request.get_json()
        
        # assigned_educator_id: solo coordinador o license_admin pueden cambiarlo
        if 'assigned_educator_id' in data:
            if not _can_assign_educator(current_user):
                pass  # ignore field
            else:
                eid = data['assigned_educator_id']
                if eid is None or eid == '':
                    child.assigned_educator_id = None
                else:
                    from models.user import Role
                    educator = User.query.filter_by(id=eid, tenant_id=child.tenant_id, is_active=True).first()
                    if not educator or educator.role_id not in [r.id for r in Role.query.filter(Role.name.in_(['educadora', 'educator'])).all()]:
                        return jsonify({'error': 'Educadora no válida'}), 400
                    tenant = Tenant.query.get(child.tenant_id)
                    max_per = getattr(tenant, 'max_children_per_educator', 10) or 10
                    count = Child.query.filter_by(tenant_id=child.tenant_id, assigned_educator_id=eid, status='activo').count()
                    if child.assigned_educator_id != eid and count >= max_per:
                        return jsonify({'error': f'La educadora ya tiene el máximo de niños asignados ({max_per})'}), 400
                    child.assigned_educator_id = eid
        
        # 1. Update Child Fields
        for field in ['first_name', 'last_name', 'cedula', 'blood_type', 
                      'allergies', 'medical_conditions', 'special_needs', 
                      'assigned_group', 'status', 'gender']:
            if field in data:
                val = data[field]
                if field == 'cedula' and not val:
                    val = None
                setattr(child, field, val)
                
        if 'birth_date' in data and data['birth_date']:
             child.birth_date = datetime.strptime(data['birth_date'], '%Y-%m-%d').date()
             
        if 'enrollment_date' in data and data['enrollment_date']:
             child.enrollment_date = datetime.strptime(data['enrollment_date'], '%Y-%m-%d').date()

        # 2. Update Family Fields
        family = child.family
        if family:
            family_fields = [
                'city', 'province', 'sector', 'neighborhood',
                'phone_primary', 'phone_secondary', 'residency_years',
                'previous_address', 'previous_city', 'housing_type',
                'employment_type', 'monthly_income_range', 'household_type',
                'economic_condition', 'geographic_zone', 'ethnic_identity',
                'has_disability', 'disability_detail', 'mobility_status',
                'migrant_origin', 'social_risks', 'emergency_contact_name', 
                'emergency_contact_phone', 'emergency_contact_relationship'
            ]
            
            # Map 'family_address' to 'address'
            if 'family_address' in data:
                family.address = data['family_address']
            
            # Map prefixed fields (e.g. family_city -> city)
            for key, value in data.items():
                # Direct match
                if key in family_fields and hasattr(family, key):
                     setattr(family, key, value)
                # Prefixed match (family_city -> city)
                elif key.startswith('family_') and key[7:] in family_fields:
                     setattr(family, key[7:], value)

        # 3. Update Primary Representative (Simplification)
        # If representatives array is passed, update the Primary one
        representatives_data = data.get('representatives', [])
        if representatives_data:
            # Assume the first one is primary or find primary
            primary_data = next((r for r in representatives_data if r.get('is_primary')), representatives_data[0])
            
            # Find existing primary rep
            rep = Representative.query.filter_by(family_id=family.id, is_primary=True).first()
            if not rep:
                # Fallback to any rep
                rep = Representative.query.filter_by(family_id=family.id).first()
                
            if rep:
                rep.first_name = primary_data.get('first_name', rep.first_name)
                rep.last_name = primary_data.get('last_name', rep.last_name)
                rep.cedula = primary_data.get('cedula') if primary_data.get('cedula') else None
                rep.phone = primary_data.get('phone', rep.phone)
                rep.email = primary_data.get('email', rep.email)
                rep.occupation = primary_data.get('occupation', rep.occupation)
                rep.workplace = primary_data.get('workplace', rep.workplace)
                rep.relationship = primary_data.get('relationship', rep.relationship)
                rep.birth_place = primary_data.get('birth_place', rep.birth_place)
                rep.birth_province = primary_data.get('birth_province', rep.birth_province)
                rep.nationality = primary_data.get('nationality', rep.nationality)

        db.session.commit()
        
        return jsonify({
            'message': 'Niño actualizado exitosamente',
            'child': child.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        import traceback
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500


# ========================
# REPRESENTATIVES ENDPOINTS
# ========================

@children_bp.route('/<int:child_id>/representatives', methods=['GET'])
@tenant_required
def get_child_representatives(child_id):
    """Get all representatives for a child (via their family)"""
    try:
        current_user = TenantContext.get_current_user()
        child = Child.query.get(child_id)
        
        if not child:
            return jsonify({'error': 'Niño no encontrado'}), 404
        
        # Permission check
        from utils.role_helpers import is_multi_center_role
        if not is_multi_center_role(current_user):
            tenant_id = TenantContext.get_current_tenant_id()
            if child.tenant_id != tenant_id:
                return jsonify({'error': 'No tienes acceso a este niño'}), 403
        
        representatives = Representative.query.filter_by(family_id=child.family_id).all()
        
        return jsonify({
            'representatives': [{
                'id': r.id,
                'first_name': r.first_name,
                'last_name': r.last_name,
                'full_name': r.full_name,
                'cedula': r.cedula,
                'relationship': r.relationship,
                'phone': r.phone,
                'email': r.email,
                'occupation': r.occupation,
                'workplace': r.workplace,
                'is_primary': r.is_primary
            } for r in representatives]
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@children_bp.route('/representatives/<int:rep_id>', methods=['PUT'])
@tenant_required
def update_representative(rep_id):
    """Update a representative's information"""
    db.session.rollback()
    
    try:
        current_user = TenantContext.get_current_user()
        representative = Representative.query.get(rep_id)
        
        if not representative:
            return jsonify({'error': 'Representante no encontrado'}), 404
        
        # Get the family to check tenant access
        family = Family.query.get(representative.family_id)
        if not family:
            return jsonify({'error': 'Familia no encontrada'}), 404
        
        # Find any child in this family to get tenant_id
        child = Child.query.filter_by(family_id=family.id).first()
        if child:
            from utils.role_helpers import is_multi_center_role
            if not is_multi_center_role(current_user):
                tenant_id = TenantContext.get_current_tenant_id()
                if child.tenant_id != tenant_id:
                    return jsonify({'error': 'No tienes acceso a este representante'}), 403
        
        data = request.get_json()
        
        # Update allowed fields
        for field in ['first_name', 'last_name', 'cedula', 'relationship', 
                      'phone', 'email', 'occupation', 'workplace', 'is_primary']:
            if field in data:
                setattr(representative, field, data[field])
        
        # If setting as primary, unset others in the same family
        if data.get('is_primary'):
            Representative.query.filter(
                Representative.family_id == representative.family_id,
                Representative.id != representative.id
            ).update({'is_primary': False})
        
        db.session.commit()
        
        return jsonify({
            'message': 'Representante actualizado exitosamente',
            'representative': {
                'id': representative.id,
                'full_name': representative.full_name,
                'phone': representative.phone,
                'email': representative.email
            }
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@children_bp.route('/representatives/<int:rep_id>', methods=['DELETE'])
@tenant_required
def delete_representative(rep_id):
    """Delete a representative"""
    db.session.rollback()
    
    try:
        current_user = TenantContext.get_current_user()
        representative = Representative.query.get(rep_id)
        
        if not representative:
            return jsonify({'error': 'Representante no encontrado'}), 404
        
        # Check access
        child = Child.query.filter_by(family_id=representative.family_id).first()
        if child:
            from utils.role_helpers import is_multi_center_role
            if not is_multi_center_role(current_user):
                tenant_id = TenantContext.get_current_tenant_id()
                if child.tenant_id != tenant_id:
                    return jsonify({'error': 'No tienes acceso'}), 403
        
        # Don't allow deleting the last representative
        rep_count = Representative.query.filter_by(family_id=representative.family_id).count()
        if rep_count <= 1:
            return jsonify({'error': 'No puedes eliminar el último representante de la familia'}), 400
        
        db.session.delete(representative)
        db.session.commit()
        
        return jsonify({'message': 'Representante eliminado'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@children_bp.route('/<int:child_id>/representatives', methods=['POST'])
@tenant_required
def add_representative(child_id):
    """Add a new representative to a child's family"""
    db.session.rollback()
    
    try:
        current_user = TenantContext.get_current_user()
        child = Child.query.get(child_id)
        
        if not child:
            return jsonify({'error': 'Niño no encontrado'}), 404
        
        # Permission check
        from utils.role_helpers import is_multi_center_role
        if not is_multi_center_role(current_user):
            tenant_id = TenantContext.get_current_tenant_id()
            if child.tenant_id != tenant_id:
                return jsonify({'error': 'No tienes acceso'}), 403
        
        data = request.get_json()
        
        representative = Representative(
            family_id=child.family_id,
            first_name=data['first_name'],
            last_name=data['last_name'],
            cedula=data.get('cedula'),
            relationship=data.get('relationship', 'otro'),
            phone=data.get('phone'),
            email=data.get('email'),
            occupation=data.get('occupation'),
            workplace=data.get('workplace'),
            is_primary=data.get('is_primary', False)
        )
        
        db.session.add(representative)
        db.session.commit()
        
        return jsonify({
            'message': 'Representante agregado',
            'representative': {
                'id': representative.id,
                'full_name': representative.full_name
            }
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
@children_bp.route('/<int:child_id>', methods=['DELETE'])
@tenant_required
def delete_child(child_id):
    """Delete a child and their associated records"""
    db.session.rollback()
    
    try:
        current_user = TenantContext.get_current_user()
        
        # Logic to find child based on role
        from utils.role_helpers import is_multi_center_role
        if is_multi_center_role(current_user):
             child = Child.query.get(child_id)
        else:
             tenant_id = TenantContext.get_current_tenant_id()
             child = Child.query.filter_by(id=child_id, tenant_id=tenant_id).first()
        
        if not child:
            return jsonify({'error': 'Niño no encontrado'}), 404
            
        # Optional: Check for related Application and unlink/delete?
        # For now, we rely on SQLAlchemy cascade for child's direct records (attendance, etc.)
        
        db.session.delete(child)
        db.session.commit()
        
        return jsonify({'message': 'Niño eliminado exitosamente'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
