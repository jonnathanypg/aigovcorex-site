"""
Seed Demo Multi-Actor Dataset & Test Users
AI GovCoreX OS — Sistema Operativo de Programas Sociales y Gobernanza Multi-Actor

Este script crea de forma aislada y segura:
 1. Licencia Demo: "Demo OS - Ecosistema Social Nacional 2026"
 2. Tipos de Organización y Organizaciones Demo en todos los niveles:
    - Nivel 1: Multilateral (BID / UNICEF)
    - Nivel 2: Gobierno Central (MIES Ecuador)
    - Nivel 3: GAD Municipal / Empresa Pública (GAD Guayaquil / Empresa Pública Social)
    - Nivel 4: ONG Ejecutora (Fundación Desarrollo y Vida)
    - Nivel 5: CDI / Centro Operativo (CDI Semillitas de Esperanza)
 3. Programa Social Demo: "Programa Nutrición y Desarrollo Infantil Integral 2026"
 4. Usuarios Demo con roles específicos y credenciales seguras.
 5. Puntos Geoespaciales y Red de Grafos ("GeoMap OS").

Ejecución:
 python3 seed_demo_multiactor.py
"""
import sys
import os
from datetime import datetime, date, timedelta

sys.path.insert(0, '.')
from app import create_app
from models import db
from models.user import User, Role
from models.license import License, LicenseAdmin
from models.tenant import Tenant
from models.organization import OrganizationType, Organization
from models.social_program import SocialProgram, ProgramFormDefinition, ProgramBeneficiary
from models.geo_intelligence import GeoLayer, GeoPoint, GeoFence, OrgNetworkEdge
from models.channel_config import ChannelConfig
from models.inter_org import OrgProgramMembership, ProgramTeamMember

app = create_app()

def run_seed():
    with app.app_context():
        print("🚀 [1/6] Creando/Verificando Tipos de Organización...")
        org_types_data = [
            {'code': 'multilateral', 'name': 'Organismo Multilateral / Cooperación', 'level': 1, 'color': '#8b5cf6', 'icon': 'Globe'},
            {'code': 'government', 'name': 'Gobierno Central / Ministerio', 'level': 2, 'color': '#0ea5e9', 'icon': 'Building2'},
            {'code': 'public_entity', 'name': 'Empresa Pública / GAD Municipal', 'level': 3, 'color': '#10b981', 'icon': 'Landmark'},
            {'code': 'ngo', 'name': 'Organización Sin Fines de Lucro / ONG', 'level': 4, 'color': '#f97316', 'icon': 'HeartHandshake'},
            {'code': 'program', 'name': 'Programa / Proyecto Social Territorial', 'level': 5, 'color': '#ec4899', 'icon': 'Layers'},
        ]
        
        type_objs = {}
        for ot in org_types_data:
            existing = OrganizationType.query.filter_by(code=ot['code']).first()
            if not existing:
                existing = OrganizationType(
                    code=ot['code'],
                    name=ot['name'],
                    level=ot['level'],
                    color=ot['color'],
                    icon=ot['icon'],
                    description=f"Entidad de Nivel {ot['level']} en la gobernanza social"
                )
                db.session.add(existing)
                db.session.flush()
            type_objs[ot['code']] = existing

        print("🏢 [2/6] Creando Licencia Demo y Centro Operativo...")
        # 1. Licencia Demo
        demo_license = License.query.filter_by(name="Demo GovCoreX - Ecosistema Social 2026").first()
        if not demo_license:
            demo_license = License(
                name="Demo GovCoreX - Ecosistema Social 2026",
                description="Licencia de prueba integral multi-actor para AI GovCoreX OS",
                legal_name="Consorcio Social Multi-Actor Demo",
                ruc="0999999999001",
                max_centers=10,
                active_centers=1,
                start_date=date.today() - timedelta(days=30),
                end_date=date.today() + timedelta(days=365),
                status="active",
                timezone="America/Guayaquil",
                whatsapp_connected=False,
                telegram_connected=False
            )
            db.session.add(demo_license)
            db.session.flush()

        # 2. Centro CDI Demo
        demo_tenant = Tenant.query.filter_by(name="CDI Demo Semillitas del Futuro").first()
        if not demo_tenant:
            demo_tenant = Tenant(
                license_id=demo_license.id,
                name="CDI Demo Semillitas del Futuro",
                legal_name="Fundación Desarrollo y Vida Demo",
                ruc="0999999999001",
                address="Av. 9 de Octubre y Malecón Simón Bolívar",
                city="Guayaquil",
                province="Guayas",
                latitude=-2.1894,
                longitude=-79.8891,
                phone="042000000",
                email="cdi.demo@govcorex.org",
                max_capacity=60,
                current_enrollment=35,
                is_active=True
            )
            db.session.add(demo_tenant)
            db.session.flush()

        print("🌐 [3/6] Creando Organizaciones Demo en Todos los Niveles...")
        # Organismo Multilateral
        org_multilateral = Organization.query.filter_by(short_name="BID-DEMO").first()
        if not org_multilateral:
            org_multilateral = Organization(
                org_type_id=type_objs['multilateral'].id,
                license_id=demo_license.id,
                name="Banco Interamericano de Desarrollo - Región Andina (Demo)",
                short_name="BID-DEMO",
                legal_id="BID-REG-001",
                country="Ecuador",
                region="Regional / Nacional",
                website="https://www.iadb.org",
                contact_email="bid.auditor@govcorex.demo",
                contact_phone="+593900000001",
                whatsapp_phone="+593900000001",
                address="Av. 12 de Octubre y Cordero, Quito",
                latitude=-0.2050,
                longitude=-78.4900,
                is_active=True,
                verified=True
            )
            db.session.add(org_multilateral)
            db.session.flush()

        # Gobierno Central
        org_ministerio = Organization.query.filter_by(short_name="MIES-DEMO").first()
        if not org_ministerio:
            org_ministerio = Organization(
                org_type_id=type_objs['government'].id,
                license_id=demo_license.id,
                parent_org_id=org_multilateral.id,
                name="Ministerio de Inclusión Económica y Social (Demo)",
                short_name="MIES-DEMO",
                legal_id="1760000000001",
                country="Ecuador",
                region="Nacional",
                website="https://www.inclusion.gob.ec",
                contact_email="mies.director@govcorex.demo",
                contact_phone="+593900000002",
                whatsapp_phone="+593900000002",
                address="Robles E3-33 y Amazonas, Quito",
                latitude=-0.2100,
                longitude=-78.4950,
                is_active=True,
                verified=True
            )
            db.session.add(org_ministerio)
            db.session.flush()

        # GAD / Empresa Pública
        org_gad = Organization.query.filter_by(short_name="GAD-GYE-DEMO").first()
        if not org_gad:
            org_gad = Organization(
                org_type_id=type_objs['public_entity'].id,
                license_id=demo_license.id,
                parent_org_id=org_ministerio.id,
                name="Empresa Pública Municipal de Acción Social y Educación (Demo)",
                short_name="DASE-GYE-DEMO",
                legal_id="0960000000001",
                country="Ecuador",
                region="Guayas",
                contact_email="gad.coordinador@govcorex.demo",
                contact_phone="+593900000003",
                whatsapp_phone="+593900000003",
                address="Clemente Ballén y Pichincha, Guayaquil",
                latitude=-2.1950,
                longitude=-79.8820,
                is_active=True,
                verified=True
            )
            db.session.add(org_gad)
            db.session.flush()

        # ONG Ejecutora
        org_ong = Organization.query.filter_by(short_name="FUNDACION-VIDA-DEMO").first()
        if not org_ong:
            org_ong = Organization(
                org_type_id=type_objs['ngo'].id,
                license_id=demo_license.id,
                parent_org_id=org_gad.id,
                name="Fundación Desarrollo y Vida Integral (Demo)",
                short_name="FUNDACION-VIDA-DEMO",
                legal_id="0999999999001",
                country="Ecuador",
                region="Guayas / Guayaquil",
                contact_email="ong.director@govcorex.demo",
                contact_phone="+593900000004",
                whatsapp_phone="+593900000004",
                address="Av. Francisco de Orellana, Guayaquil",
                latitude=-2.1600,
                longitude=-79.8970,
                is_active=True,
                verified=True
            )
            db.session.add(org_ong)
            db.session.flush()

        print("👥 [4/6] Creando Usuarios Demo en Cada Nivel Jerárquico...")
        roles_map = {r.name: r for r in Role.query.all()}
        
        users_data = [
            # 1. Auditor Multilateral (BID)
            {
                'email': 'demo.multilateral@govcorex.org',
                'first_name': 'Carlos',
                'last_name': 'Valenzuela (BID)',
                'cedula': '0900000001',
                'role': 'supervisor',
                'tenant_id': None,
                'whatsapp_phone': '+593900000001',
                'desc': 'Auditor / Director de Organismo Multilateral'
            },
            # 2. Director Nacional de Gobierno (MIES)
            {
                'email': 'demo.gobierno@govcorex.org',
                'first_name': 'Elena',
                'last_name': 'Paredes (MIES)',
                'cedula': '0900000002',
                'role': 'license_admin',
                'tenant_id': None,
                'whatsapp_phone': '+593900000002',
                'desc': 'Director Nacional de Programa Gubernamental / Licencia'
            },
            # 3. Director de Empresa Pública / Alcaldía
            {
                'email': 'demo.gad@govcorex.org',
                'first_name': 'Santiago',
                'last_name': 'Morales (GAD GYE)',
                'cedula': '0900000003',
                'role': 'supervisor',
                'tenant_id': None,
                'whatsapp_phone': '+593900000003',
                'desc': 'Supervisor de Gobierno Local / Empresa Pública'
            },
            # 4. Director de ONG Ejecutora
            {
                'email': 'demo.ong@govcorex.org',
                'first_name': 'Gabriela',
                'last_name': 'Mendoza (ONG)',
                'cedula': '0900000004',
                'role': 'coordinator',
                'tenant_id': demo_tenant.id,
                'whatsapp_phone': '+593900000004',
                'desc': 'Directora de ONG / Coordinadora Territorial'
            },
            # 5. Educadora / Brigadista de Campo
            {
                'email': 'demo.educadora@govcorex.org',
                'first_name': 'Mariana',
                'last_name': 'Suárez (Campo)',
                'cedula': '0900000005',
                'role': 'educator',
                'tenant_id': demo_tenant.id,
                'whatsapp_phone': '+593900000005',
                'desc': 'Educadora de CDI / Brigadista de Campo'
            },
            # 6. Médico / Especialista Universal
            {
                'email': 'demo.medico@govcorex.org',
                'first_name': 'Dr. Fernando',
                'last_name': 'Almeida (Salud)',
                'cedula': '0900000006',
                'role': 'doctor',
                'tenant_id': None,
                'whatsapp_phone': '+593900000006',
                'desc': 'Médico Comunitario / Especialista en Salud y Nutrición'
            },
            # 7. Trabajadora Social
            {
                'email': 'demo.social@govcorex.org',
                'first_name': 'Patricia',
                'last_name': 'Gómez (Fichas)',
                'cedula': '0900000007',
                'role': 'social_worker',
                'tenant_id': None,
                'whatsapp_phone': '+593900000007',
                'desc': 'Trabajadora Social / Admisión y Fichas Socioeconómicas'
            }
        ]

        created_users = []
        for ud in users_data:
            u = User.query.filter_by(email=ud['email']).first()
            if not u:
                role_obj = roles_map.get(ud['role'])
                if not role_obj:
                    role_obj = roles_map.get('coordinator')
                u = User(
                    email=ud['email'],
                    first_name=ud['first_name'],
                    last_name=ud['last_name'],
                    cedula=ud['cedula'],
                    role_id=role_obj.id,
                    tenant_id=ud['tenant_id'],
                    whatsapp_phone=ud['whatsapp_phone'],
                    phone=ud['whatsapp_phone'],
                    is_active=True
                )
                u.set_password('GovCoreX2026!')
                db.session.add(u)
                db.session.flush()
                print(f"  ✅ Usuario Creado: {u.email} ({ud['desc']})")
            else:
                u.set_password('GovCoreX2026!')
                print(f"  ⏭️ Usuario Ya Existe: {u.email}")
            created_users.append(u)

        # Asignar Elena Paredes como LicenseAdmin
        admin_user = User.query.filter_by(email='demo.gobierno@govcorex.org').first()
        if admin_user:
            la = LicenseAdmin.query.filter_by(license_id=demo_license.id, user_id=admin_user.id).first()
            if not la:
                la = LicenseAdmin(
                    license_id=demo_license.id,
                    user_id=admin_user.id,
                    can_create_centers=True,
                    can_manage_users=True,
                    is_active=True
                )
                db.session.add(la)

        print("📋 [5/6] Creando Programa Social Demo y Formularios...")
        demo_program = SocialProgram.query.filter_by(short_code="PROG-NUTRI-2026").first()
        if not demo_program:
            demo_program = SocialProgram(
                license_id=demo_license.id,
                lead_org_id=org_ministerio.id,
                created_by_user_id=admin_user.id if admin_user else created_users[0].id,
                name="Programa Nacional de Nutrición y Desarrollo Infantil Integral 2026",
                short_code="PROG-NUTRI-2026",
                category="Salud y Nutrición Infantil",
                description="Intervención integral contra la desnutrición crónica infantil y seguimiento IDII en centros y brigadas.",
                objectives="Reducir en 5% la DCI, asegurar 100% de controles antropométricos mensuales y cobertura alimentaria.",
                status="active",
                start_date=date(2026, 1, 1),
                end_date=date(2026, 12, 31),
                total_budget=1250000.00,
                currency="USD",
                coverage_country="Ecuador",
                coverage_regions=["Guayas", "Pichincha", "Manabí"],
                max_beneficiaries=1500,
                current_beneficiaries=35,
                inherit_org_channels=True,
                tags=["nutricion", "primera_infancia", "mies", "bid", "dci"]
            )
            db.session.add(demo_program)
            db.session.flush()

            # Formulario Dinámico
            form_fields = [
                {'id': 'cedula_tutor', 'type': 'cedula', 'label': 'Cédula del Representante/Tutor', 'required': True},
                {'id': 'nombre_nino', 'type': 'text', 'label': 'Nombres y Apellidos del Niño/a', 'required': True},
                {'id': 'fecha_nacimiento', 'type': 'date', 'label': 'Fecha de Nacimiento', 'required': True},
                {'id': 'peso_actual', 'type': 'number', 'label': 'Peso Actual (kg)', 'required': True},
                {'id': 'talla_actual', 'type': 'number', 'label': 'Talla Actual (cm)', 'required': True},
                {'id': 'ingreso_familiar', 'type': 'number', 'label': 'Ingreso Mensual del Hogar (USD)', 'required': False},
                {'id': 'recibe_bono', 'type': 'boolean', 'label': '¿Recibe Bono de Desarrollo Humano?', 'required': True},
                {'id': 'foto_carnet_vacunas', 'type': 'file', 'label': 'Foto de Carnet de Vacunación', 'required': False},
                {'id': 'ubicacion_gps', 'type': 'geopoint', 'label': 'Ubicación del Domicilio', 'required': True}
            ]
            form_def = ProgramFormDefinition(
                program_id=demo_program.id,
                form_title="Ficha de Inscripción y Tamizaje Nutricional 2026",
                form_description="Formulario unificado para postulación presencial, web y conversacional por WhatsApp/Telegram.",
                fields=form_fields,
                conversational_instructions="Pide de forma amable los datos del tutor, niño y controles de peso y talla.",
                success_message="¡Registro completado exitosamente! Un brigadista o educadora validará tu información."
            )
            db.session.add(form_def)

            # Membresías Interinstitucionales en el Programa
            m1 = OrgProgramMembership(
                organization_id=org_multilateral.id,
                program_id=demo_program.id,
                added_by_user_id=admin_user.id if admin_user else created_users[0].id,
                org_role="funder",
                org_role_label="Organismo Financiador y Auditor",
                budget_assigned=800000.00,
                can_view_beneficiaries=True,
                can_view_reports=True,
                data_access_level="summary",
                status="active"
            )
            m2 = OrgProgramMembership(
                organization_id=org_ministerio.id,
                program_id=demo_program.id,
                added_by_user_id=admin_user.id if admin_user else created_users[0].id,
                org_role="supervisor",
                org_role_label="Entidad Garante y Normativa",
                budget_assigned=300000.00,
                can_view_beneficiaries=True,
                can_edit_program=True,
                can_view_reports=True,
                data_access_level="full",
                status="active"
            )
            m3 = OrgProgramMembership(
                organization_id=org_ong.id,
                program_id=demo_program.id,
                added_by_user_id=admin_user.id if admin_user else created_users[0].id,
                org_role="executor",
                org_role_label="ONG Operadora en Territorio",
                budget_assigned=150000.00,
                can_view_beneficiaries=True,
                can_view_reports=True,
                data_access_level="full",
                status="active"
            )
            db.session.add_all([m1, m2, m3])

        print("🗺️ [6/6] Creando Puntos y Grafos para 'GeoMap OS'...")
        # Capas Geográficas
        layer_centros = GeoLayer.query.filter_by(name="Centros de Atención Infantil").first()
        if not layer_centros:
            layer_centros = GeoLayer(
                program_id=demo_program.id if demo_program else None,
                license_id=demo_license.id,
                name="Centros de Atención Infantil",
                description="Ubicación física de guarderías y CDIs",
                layer_type="points",
                default_color="#10b981",
                is_visible=True
            )
            layer_alertas = GeoLayer(
                program_id=demo_program.id if demo_program else None,
                license_id=demo_license.id,
                name="Alertas Nutricionales y Sanitarias",
                description="Casos que requieren visita o suplementación",
                layer_type="heatmap",
                default_color="#ef4444",
                is_visible=True
            )
            db.session.add_all([layer_centros, layer_alertas])
            db.session.flush()

            # Puntos Demo
            p1 = GeoPoint(
                program_id=demo_program.id,
                tenant_id=demo_tenant.id,
                layer_id=layer_centros.id,
                point_type="center",
                name="CDI Semillitas del Futuro - Centro Guayaquil",
                latitude=-2.1894,
                longitude=-79.8891,
                color="#10b981",
                icon="Building2",
                properties={"ninos_activos": 35, "capacidad": 60, "estado": "Operativo"}
            )
            p2 = GeoPoint(
                program_id=demo_program.id,
                layer_id=layer_alertas.id,
                point_type="incident",
                name="Alerta DCI Crítica: Sector Guasmo Sur",
                latitude=-2.2600,
                longitude=-79.8950,
                color="#ef4444",
                icon="AlertTriangle",
                properties={"casos": 4, "tipo": "Desnutrición Moderada/Severa", "prioridad": "Alta"}
            )
            p3 = GeoPoint(
                program_id=demo_program.id,
                layer_id=layer_alertas.id,
                point_type="incident",
                name="Alerta Anemia Leve: Sector Monte Sinaí",
                latitude=-2.1100,
                longitude=-79.9700,
                color="#f97316",
                icon="AlertTriangle",
                properties={"casos": 6, "tipo": "Anemia Leve", "prioridad": "Media"}
            )
            db.session.add_all([p1, p2, p3])

            # Cerco Digital
            fence = GeoFence(
                program_id=demo_program.id,
                layer_id=layer_alertas.id,
                name="Cerco Prioritario Zona 8 (Guayaquil-Durán-Samborondón)",
                fence_type="coverage_zone",
                color="#0ea5e9",
                fill_opacity=0.15,
                geojson='{"type":"Polygon","coordinates":[[[-79.98,-2.08],[-79.82,-2.08],[-79.82,-2.28],[-79.98,-2.28],[-79.98,-2.08]]]}',
                is_active=True
            )
            db.session.add(fence)

            # Grafo de Red Interinstitucional (Aristas)
            e1 = OrgNetworkEdge(
                source_org_id=org_multilateral.id,
                target_org_id=org_ministerio.id,
                relationship_type="funds",
                label="Financiamiento y Cooperación Técnica BID ↔ MIES",
                weight=1.0,
                color="#8b5cf6"
            )
            e2 = OrgNetworkEdge(
                source_org_id=org_ministerio.id,
                target_org_id=org_ong.id,
                relationship_type="supervises",
                label="Convenio de Operación MIES ↔ Fundación Vida",
                weight=0.8,
                color="#0ea5e9"
            )
            e3 = OrgNetworkEdge(
                source_org_id=org_gad.id,
                target_org_id=org_ong.id,
                relationship_type="partners",
                label="Apoyo Logístico Territorial GAD ↔ Fundación Vida",
                weight=0.6,
                color="#10b981"
            )
            db.session.add_all([e1, e2, e3])

        # Canal Demo WhatsApp / Telegram
        ch_demo = ChannelConfig.query.filter_by(channel_name="WhatsApp Demo Institucional").first()
        if not ch_demo:
            ch_demo = ChannelConfig(
                org_id=org_ministerio.id,
                program_id=demo_program.id if demo_program else None,
                license_id=demo_license.id,
                channel_type="whatsapp",
                channel_name="WhatsApp Demo Institucional",
                phone_number="+593900000000",
                session_id="session_demo_govcorex",
                ownership_type="shared",
                access_level="program",
                status="disconnected",
                agent_name="GovCoreX Bot Asistente",
                agent_personality="Asistente institucional formal, empático y claro.",
                welcome_message="Bienvenido al Sistema de Atención Ciudadana para Programas Sociales."
            )
            db.session.add(ch_demo)

        db.session.commit()
        print("\n✨ ¡SEED MULTI-ACTOR COMPLETADO CON ÉXITO!")

if __name__ == "__main__":
    run_seed()
