"""
Inter-organizational Models
AI GovCoreX OS — Vinculación entre Organizaciones, Programas y Equipos
"""
from models import db, BaseModel
from sqlalchemy.dialects.mysql import JSON
from datetime import datetime


class OrgProgramMembership(db.Model, BaseModel):
    """
    Membresía/Vinculación de una Organización en un Programa Social
    Define el rol que juega una organización dentro de un programa.
    """
    __tablename__ = 'org_program_memberships'

    id = db.Column(db.Integer, primary_key=True)
    organization_id = db.Column(db.Integer, db.ForeignKey('organizations.id'), nullable=False)
    program_id = db.Column(db.Integer, db.ForeignKey('social_programs.id'), nullable=False)
    added_by_user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)

    # Rol de la organización en el programa
    org_role = db.Column(db.String(50), nullable=False)           # 'funder', 'executor', 'supervisor', 'partner', 'beneficiary_org'
    org_role_label = db.Column(db.String(200))                    # Nombre descriptivo del rol
    start_date = db.Column(db.Date)
    end_date = db.Column(db.Date)

    # Permisos dentro del programa para esta organización
    can_view_beneficiaries = db.Column(db.Boolean, default=True)
    can_edit_program = db.Column(db.Boolean, default=False)
    can_manage_channels = db.Column(db.Boolean, default=False)
    can_view_reports = db.Column(db.Boolean, default=True)
    can_view_geo_data = db.Column(db.Boolean, default=True)
    data_access_level = db.Column(db.String(30), default='summary')  # 'full', 'summary', 'aggregate_only'

    # Presupuesto asignado a esta organización en el programa
    budget_assigned = db.Column(db.Numeric(15, 2))
    budget_executed = db.Column(db.Numeric(15, 2), default=0)

    status = db.Column(db.String(30), default='active')           # 'pending', 'active', 'suspended', 'ended'
    invitation_token = db.Column(db.String(100), unique=True)     # Para invitación por link
    notes = db.Column(db.Text)

    __table_args__ = (
        db.UniqueConstraint('organization_id', 'program_id', name='unique_org_program'),
        db.Index('idx_membership_program', 'program_id'),
        db.Index('idx_membership_org', 'organization_id'),
    )

    def to_dict(self) -> dict:
        """Convert to dictionary"""
        return {
            'id': self.id,
            'organization_id': self.organization_id,
            'program_id': self.program_id,
            'org_role': self.org_role,
            'org_role_label': self.org_role_label,
            'can_view_beneficiaries': self.can_view_beneficiaries,
            'can_edit_program': self.can_edit_program,
            'can_manage_channels': self.can_manage_channels,
            'can_view_reports': self.can_view_reports,
            'can_view_geo_data': self.can_view_geo_data,
            'data_access_level': self.data_access_level,
            'budget_assigned': float(self.budget_assigned) if self.budget_assigned else None,
            'status': self.status,
        }


class ProgramTeamMember(db.Model, BaseModel):
    """
    Miembro del Equipo de un Programa Social
    Asigna personas (usuarios) a un programa con roles específicos.
    """
    __tablename__ = 'program_team_members'

    id = db.Column(db.Integer, primary_key=True)
    program_id = db.Column(db.Integer, db.ForeignKey('social_programs.id'), nullable=False)
    org_membership_id = db.Column(
        db.Integer,
        db.ForeignKey('org_program_memberships.id'),
        nullable=True,
    )
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    added_by_user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)

    # Datos del miembro si no tiene cuenta
    external_name = db.Column(db.String(255))
    external_email = db.Column(db.String(255))
    external_phone = db.Column(db.String(30))

    team_role = db.Column(db.String(50), nullable=False)          # 'coordinator', 'field_worker', 'supervisor', 'analyst', 'driver'
    team_role_label = db.Column(db.String(200))

    # Permisos específicos del miembro
    permissions = db.Column(JSON)                                 # Lista de permisos granulares
    geographic_zone = db.Column(db.String(200))                   # Zona geográfica asignada
    sector = db.Column(db.String(200))                            # Sector o comunidad asignada

    status = db.Column(db.String(30), default='active')           # 'active', 'suspended', 'ended'
    latitude = db.Column(db.Float)                                # Última ubicación conocida
    longitude = db.Column(db.Float)
    last_location_at = db.Column(db.DateTime)

    def to_dict(self) -> dict:
        """Convert to dictionary"""
        return {
            'id': self.id,
            'program_id': self.program_id,
            'user_id': self.user_id,
            'external_name': self.external_name,
            'external_email': self.external_email,
            'team_role': self.team_role,
            'team_role_label': self.team_role_label,
            'permissions': self.permissions,
            'geographic_zone': self.geographic_zone,
            'sector': self.sector,
            'status': self.status,
            'latitude': self.latitude,
            'longitude': self.longitude,
        }
