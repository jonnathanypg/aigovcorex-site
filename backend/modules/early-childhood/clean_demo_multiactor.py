"""
Clean Demo Multi-Actor Dataset
AI GovCoreX OS — Script para revertir o eliminar exclusivamente los datos de prueba demo.

Ejecución:
 python3 clean_demo_multiactor.py
"""
import sys
sys.path.insert(0, '.')
from app import create_app
from models import db
from models.user import User
from models.license import License, LicenseAdmin
from models.tenant import Tenant
from models.organization import Organization, OrganizationType
from models.social_program import SocialProgram, ProgramFormDefinition, ProgramBeneficiary
from models.geo_intelligence import GeoLayer, GeoPoint, GeoFence, OrgNetworkEdge
from models.channel_config import ChannelConfig, ChannelConversation
from models.inter_org import OrgProgramMembership, ProgramTeamMember

app = create_app()

def run_cleanup():
    with app.app_context():
        print("🧹 Eliminando datos demo aislados...")
        
        # 1. Usuarios demo
        demo_emails = [
            'demo.multilateral@govcorex.org',
            'demo.gobierno@govcorex.org',
            'demo.gad@govcorex.org',
            'demo.ong@govcorex.org',
            'demo.educadora@govcorex.org',
            'demo.medico@govcorex.org',
            'demo.social@govcorex.org'
        ]
        users = User.query.filter(User.email.in_(demo_emails)).all()
        for u in users:
            LicenseAdmin.query.filter_by(user_id=u.id).delete()
            db.session.delete(u)
            print(f"  🗑️ Usuario eliminado: {u.email}")
            
        # 2. Programas demo y componentes
        prog = SocialProgram.query.filter_by(short_code="PROG-NUTRI-2026").first()
        if prog:
            OrgProgramMembership.query.filter_by(program_id=prog.id).delete()
            ProgramBeneficiary.query.filter_by(program_id=prog.id).delete()
            ProgramFormDefinition.query.filter_by(program_id=prog.id).delete()
            GeoPoint.query.filter_by(program_id=prog.id).delete()
            GeoFence.query.filter_by(program_id=prog.id).delete()
            GeoLayer.query.filter_by(program_id=prog.id).delete()
            ChannelConfig.query.filter_by(program_id=prog.id).delete()
            db.session.delete(prog)
            print(f"  🗑️ Programa social demo eliminado")

        # 3. Aristas de red demo
        OrgNetworkEdge.query.filter(OrgNetworkEdge.label.like('%BID%')).delete()
        OrgNetworkEdge.query.filter(OrgNetworkEdge.label.like('%MIES%')).delete()
        OrgNetworkEdge.query.filter(OrgNetworkEdge.label.like('%GAD%')).delete()

        # 4. Organizaciones demo
        demo_orgs = ["BID-DEMO", "MIES-DEMO", "DASE-GYE-DEMO", "FUNDACION-VIDA-DEMO"]
        for sname in demo_orgs:
            org = Organization.query.filter_by(short_name=sname).first()
            if org:
                db.session.delete(org)
                print(f"  🗑️ Organización eliminada: {sname}")

        # 5. Centro demo y Licencia demo
        tenant = Tenant.query.filter_by(name="CDI Demo Semillitas del Futuro").first()
        if tenant:
            db.session.delete(tenant)
            print(f"  🗑️ Centro demo eliminado")

        license_demo = License.query.filter_by(name="Demo GovCoreX - Ecosistema Social 2026").first()
        if license_demo:
            db.session.delete(license_demo)
            print(f"  🗑️ Licencia demo eliminada")

        db.session.commit()
        print("\n✅ ¡Limpieza de datos demo completada!")

if __name__ == "__main__":
    run_cleanup()
