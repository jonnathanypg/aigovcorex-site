"""
Geo Intelligence Models — "Ojo de Dios"
AI GovCoreX OS — Inteligencia Geoespacial y Grafos de Red

Incluye: puntos georreferenciados, cercos digitales, capas y grafos de red.
"""
from models import db, BaseModel
from sqlalchemy.dialects.mysql import JSON
from datetime import datetime


class GeoLayer(db.Model, BaseModel):
    """
    Capa Geográfica Temática
    Agrupa puntos de un mismo tema (ej: "Capa de Nutrición Crítica", "Capa de Brigadas").
    Declared before GeoPoint to resolve forward-reference FK at table-creation time.
    """
    __tablename__ = 'geo_layers'

    id = db.Column(db.Integer, primary_key=True)
    program_id = db.Column(db.Integer, db.ForeignKey('social_programs.id'), nullable=True)
    license_id = db.Column(db.Integer, db.ForeignKey('licenses.id'), nullable=True)

    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    layer_type = db.Column(db.String(50))                         # 'points', 'heatmap', 'polygon', 'route'
    default_color = db.Column(db.String(7), default='#10b981')
    is_visible = db.Column(db.Boolean, default=True)
    opacity = db.Column(db.Float, default=0.8)
    order_index = db.Column(db.Integer, default=0)

    # Relationships
    points = db.relationship('GeoPoint', backref='layer', lazy='dynamic')
    fences = db.relationship('GeoFence', backref='layer', lazy='dynamic')

    def to_dict(self) -> dict:
        """Convert to dictionary"""
        return {
            'id': self.id,
            'program_id': self.program_id,
            'name': self.name,
            'description': self.description,
            'layer_type': self.layer_type,
            'default_color': self.default_color,
            'is_visible': self.is_visible,
            'opacity': self.opacity,
            'points_count': self.points.count(),
        }


class GeoPoint(db.Model, BaseModel):
    """
    Punto Georreferenciado en el Sistema
    Puede representar: un centro, un beneficiario, un brigadista, una incidencia, etc.
    """
    __tablename__ = 'geo_points'

    id = db.Column(db.Integer, primary_key=True)
    program_id = db.Column(db.Integer, db.ForeignKey('social_programs.id'), nullable=True)
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenants.id'), nullable=True)
    license_id = db.Column(db.Integer, db.ForeignKey('licenses.id'), nullable=True)

    # Tipo de punto
    point_type = db.Column(db.String(50), nullable=False)          # 'center', 'beneficiary', 'brigade', 'incident', 'custom'
    layer_id = db.Column(db.Integer, db.ForeignKey('geo_layers.id'), nullable=True)

    # Datos del punto
    name = db.Column(db.String(255))
    description = db.Column(db.Text)
    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)
    altitude = db.Column(db.Float)                                # metros sobre nivel del mar

    # Visualización
    color = db.Column(db.String(7), default='#10b981')            # Hex color
    icon = db.Column(db.String(50))                               # Lucide icon name
    size = db.Column(db.Integer, default=10)                      # Tamaño del marcador en px

    # Referencia a entidad relacionada
    ref_entity_type = db.Column(db.String(50))                    # 'child', 'beneficiary', 'user', 'tenant'
    ref_entity_id = db.Column(db.Integer)

    # Datos adicionales
    properties = db.Column(JSON)                                  # Propiedades custom
    is_active = db.Column(db.Boolean, default=True)
    last_seen_at = db.Column(db.DateTime)                         # Última actualización GPS

    __table_args__ = (
        db.Index('idx_geopoint_program', 'program_id'),
        db.Index('idx_geopoint_type', 'point_type'),
        db.Index('idx_geopoint_coords', 'latitude', 'longitude'),
    )

    def to_dict(self) -> dict:
        """Convert to dictionary"""
        return {
            'id': self.id,
            'program_id': self.program_id,
            'tenant_id': self.tenant_id,
            'point_type': self.point_type,
            'layer_id': self.layer_id,
            'name': self.name,
            'description': self.description,
            'latitude': self.latitude,
            'longitude': self.longitude,
            'color': self.color,
            'icon': self.icon,
            'ref_entity_type': self.ref_entity_type,
            'ref_entity_id': self.ref_entity_id,
            'properties': self.properties,
            'is_active': self.is_active,
            'last_seen_at': self.last_seen_at.isoformat() if self.last_seen_at else None,
        }


class GeoFence(db.Model, BaseModel):
    """
    Cerco Digital / Zona de Análisis
    Polígono de área para análisis sectorial, alertas y barridos territoriales.
    """
    __tablename__ = 'geo_fences'

    id = db.Column(db.Integer, primary_key=True)
    program_id = db.Column(db.Integer, db.ForeignKey('social_programs.id'), nullable=True)
    license_id = db.Column(db.Integer, db.ForeignKey('licenses.id'), nullable=True)
    layer_id = db.Column(db.Integer, db.ForeignKey('geo_layers.id'), nullable=True)

    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    fence_type = db.Column(db.String(50))                         # 'coverage_zone', 'alert_zone', 'sector', 'sweep_area'
    geojson = db.Column(db.Text, nullable=False)                  # GeoJSON polygon definition
    color = db.Column(db.String(7), default='#10b981')
    fill_opacity = db.Column(db.Float, default=0.2)
    border_color = db.Column(db.String(7))
    is_active = db.Column(db.Boolean, default=True)
    alert_threshold = db.Column(db.Integer)                       # Ej: alerta si >X incidencias dentro
    properties = db.Column(JSON)

    def to_dict(self) -> dict:
        """Convert to dictionary"""
        return {
            'id': self.id,
            'program_id': self.program_id,
            'name': self.name,
            'description': self.description,
            'fence_type': self.fence_type,
            'geojson': self.geojson,
            'color': self.color,
            'fill_opacity': self.fill_opacity,
            'is_active': self.is_active,
        }


class OrgNetworkEdge(db.Model, BaseModel):
    """
    Arista del Grafo de Red Interinstitucional
    Define una relación entre dos organizaciones o entre org y programa.
    """
    __tablename__ = 'org_network_edges'

    id = db.Column(db.Integer, primary_key=True)
    source_org_id = db.Column(db.Integer, db.ForeignKey('organizations.id'), nullable=False)
    target_org_id = db.Column(db.Integer, db.ForeignKey('organizations.id'), nullable=True)
    target_program_id = db.Column(db.Integer, db.ForeignKey('social_programs.id'), nullable=True)
    license_id = db.Column(db.Integer, db.ForeignKey('licenses.id'), nullable=True)

    relationship_type = db.Column(db.String(50))                  # 'funds', 'executes', 'supervises', 'partners'
    label = db.Column(db.String(200))
    weight = db.Column(db.Float, default=1.0)                     # Peso de la arista en el grafo
    color = db.Column(db.String(7))
    is_active = db.Column(db.Boolean, default=True)
    properties = db.Column(JSON)

    source = db.relationship('Organization', foreign_keys=[source_org_id])
    target_org = db.relationship('Organization', foreign_keys=[target_org_id])

    def to_dict(self) -> dict:
        """Convert to dictionary"""
        return {
            'id': self.id,
            'source_org_id': self.source_org_id,
            'target_org_id': self.target_org_id,
            'target_program_id': self.target_program_id,
            'relationship_type': self.relationship_type,
            'label': self.label,
            'weight': self.weight,
            'color': self.color,
        }
