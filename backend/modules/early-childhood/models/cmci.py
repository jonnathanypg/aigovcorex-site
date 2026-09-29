"""
CMCI models — Fase 0 (§Fase 0 + §10 del plan)
Tablas nuevas versionadas por registro (histórico, nunca sobreescribir).
db.JSON genérico (compatible MySQL + SQLite).
Sin firma electrónica: NO existe tabla signatures (firma física en papel).
"""
from models import db, BaseModel


class CmciCenter(db.Model, BaseModel):
    """Centro CMCI (Bahía BH / Guasmo GU / Orquídeas OR)."""
    __tablename__ = 'cmci_centers'

    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(10), unique=True, nullable=False)  # BH / GU / OR
    name = db.Column(db.String(255), nullable=False)
    coverage_total = db.Column(db.Integer, default=72, nullable=False)
    parish = db.Column(db.String(255))
    district = db.Column(db.String(255))
    country_iso = db.Column(db.String(5), default='EC', nullable=False)

    __table_args__ = (
        db.Index('idx_cmci_center_code', 'code'),
    )

    def __repr__(self):
        return f'<CmciCenter {self.code} {self.name}>'


class VulnerabilityAssessment(db.Model, BaseModel):
    """
    Ficha de vulnerabilidad CMCI — un registro por valoración (histórico por assessed_at).
    Réplica §3.1 del plan (33 indicadores, D1-D8, F78-F84, alertas G88-G97, Y/Z ranking fuera).
    """
    __tablename__ = 'vulnerability_assessments'

    id = db.Column(db.Integer, primary_key=True)
    child_id = db.Column(db.Integer, db.ForeignKey('children.id'), nullable=True)
    center_id = db.Column(db.Integer, db.ForeignKey('tenants.id'), nullable=True)
    code = db.Column(db.String(50))  # ej. FV-GASIBA-2026-OR-002
    assessed_at = db.Column(db.Date)
    birth_date = db.Column(db.Date)
    age_months = db.Column(db.Integer)
    in_range = db.Column(db.Boolean, default=True)  # EN RANGO iff 12<=m<=42

    answers = db.Column(db.JSON)   # 33 respuestas {I1.1: texto | score...}
    scores = db.Column(db.JSON)    # {I1.1: 0-4, ...}
    subtotals = db.Column(db.JSON)  # {D1..D8: float}

    total = db.Column(db.Float, default=0.0)  # F78 0-100
    level = db.Column(db.String(60))          # F80 nivel
    semaphore = db.Column(db.String(20))      # F81 VERDE/AMARILLO/NARANJA/ROJO
    protection_alert = db.Column(db.Boolean, default=False)  # F82
    priority = db.Column(db.String(30))       # F83 PRIORIDAD 1/2/3
    childcare_need = db.Column(db.String(20))  # F84 ALTA/MEDIA/BAJA
    alerts = db.Column(db.JSON)  # G88:G97 {proteccion: bool, ...}

    status = db.Column(db.String(50), default='En proceso')
    # En proceso / Completa / Pendiente / Validada / Admitida / No admitida / Lista espera
    # (legacy "Pendiente de revisión" normalizar a "Pendiente" en capa API, no aquí)

    ml_proba = db.Column(db.Float, nullable=True)
    ml_version = db.Column(db.String(50), nullable=True)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'))

    __table_args__ = (
        db.Index('idx_vuln_child', 'child_id'),
        db.Index('idx_vuln_center', 'center_id'),
        db.Index('idx_vuln_code', 'code'),
        db.Index('idx_vuln_status', 'status'),
    )

    child = db.relationship('Child', backref='vulnerability_assessments')
    center = db.relationship('Tenant', foreign_keys=[center_id])
    creator = db.relationship('User', foreign_keys=[created_by])


class SocioeconomicAssessment(db.Model, BaseModel):
    """
    Ficha socioeconómica CMCI v2 — un registro por valoración (espejo vivo, nunca sobreescribir).
    Réplica §3.2 + §10.1 (B64/B65/B68 literales, SUMPRODUCT, E63).
    """
    __tablename__ = 'socioeconomic_assessments'

    id = db.Column(db.Integer, primary_key=True)
    child_id = db.Column(db.Integer, db.ForeignKey('children.id'), nullable=True)
    center_id = db.Column(db.Integer, db.ForeignKey('tenants.id'), nullable=True)
    code = db.Column(db.String(50))
    assessed_at = db.Column(db.Date)

    incomes = db.Column(db.JSON)   # B18:B25 desglose
    expenses = db.Column(db.JSON)  # B29:B38 desglose
    per_capita = db.Column(db.Float)      # E19
    expense_ratio = db.Column(db.Float)   # E31
    coverage_services = db.Column(db.Float)  # B55
    dependency = db.Column(db.Float)      # B54 personas/perceptor

    subscores = db.Column(db.JSON)  # B62:B68 (7 subpuntajes 100/60/20)
    total = db.Column(db.Float, default=0.0)  # E62 SUMPRODUCT (100=mejor)
    classification = db.Column(db.String(20))  # E63 alta/media/baja

    __table_args__ = (
        db.Index('idx_socio_child', 'child_id'),
        db.Index('idx_socio_center', 'center_id'),
        db.Index('idx_socio_code', 'code'),
    )

    child = db.relationship('Child', backref='socioeconomic_assessments')
    center = db.relationship('Tenant', foreign_keys=[center_id])


class ScoringParams(db.Model, BaseModel):
    """
    Hoja PARÁMETROS versionada (pesos, rangos, umbrales, opciones, cortes, fórmulas).
    scope: global | country:EC | country:XX | center:BH ...
    version: v1_validada_2026-09-25 inmutable; cambios → v2 (nunca reescribe histórico).
    """
    __tablename__ = 'scoring_params'

    id = db.Column(db.Integer, primary_key=True)
    scope = db.Column(db.String(30), nullable=False, default='global')
    key = db.Column(db.String(100), nullable=False)
    value = db.Column(db.JSON, nullable=False)
    version = db.Column(db.String(50), default='v1_validada_2026-09-25', nullable=False)

    __table_args__ = (
        db.Index('idx_scoring_scope_key', 'scope', 'key'),
        db.Index('idx_scoring_version', 'version'),
    )


class CountryConfig(db.Model, BaseModel):
    """Config por país (EC default). Sin hardcodes de país en código."""
    __tablename__ = 'country_configs'

    country_iso = db.Column(db.String(5), primary_key=True)  # EC, ...
    phone_prefix = db.Column(db.String(10))   # 593
    phone_example = db.Column(db.String(30))
    id_type = db.Column(db.String(30))        # cedula
    id_validation = db.Column(db.String(50))  # modulo-10
    timezone = db.Column(db.String(60))       # America/Guayaquil
    currency = db.Column(db.String(10))       # USD


class DocumentTemplate(db.Model, BaseModel):
    """Biblioteca: 15 plantillas cerradas (§10.6). Descarga en blanco, no expedientes pesados."""
    __tablename__ = 'document_templates'

    # 15 categorías fijas §10.6 (enum a nivel app, no libre)
    CATEGORIES = (
        'protocolo_requisitos_ingreso',
        'ficha_postulacion',
        'ficha_cdp',
        'ficha_socioeconomica',
        'ficha_vulnerabilidad',
        'informe_tecnico_visita',
        'acta_compromiso_corresponsabilidad',
        'consentimiento_informado',
        'autorizacion_imagen',
        'ficha_idii',
        'historia_clinica',
        'monitoreo_nutricional_curvas',
        'ficha_diaria_alimentacion',
        'menu_semanal',
        'informe_mensual',
    )

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    category = db.Column(db.String(60), nullable=False)  # una de CATEGORIES
    file_url = db.Column(db.String(500))
    version = db.Column(db.String(50))

    __table_args__ = (
        db.Index('idx_doctpl_category', 'category'),
    )


class MonthlyReport(db.Model, BaseModel):
    """Informe mensual TTHH multi-rol (§10.2): educadora|auxiliar|trabajo_social|coordinacion|asistente."""
    __tablename__ = 'monthly_reports'

    REPORT_TYPES = ('educadora', 'auxiliar', 'trabajo_social', 'coordinacion', 'asistente')

    id = db.Column(db.Integer, primary_key=True)
    educator_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    center_id = db.Column(db.Integer, db.ForeignKey('tenants.id'))
    report_type = db.Column(db.String(30), nullable=False, default='educadora')
    period_start = db.Column(db.Date)
    period_end = db.Column(db.Date)
    payload = db.Column(db.JSON)  # planificaciones, asistencia, niños, casos, talleres...
    conclusions_auto = db.Column(db.Text)
    educator_notes = db.Column(db.String(2000))  # máx 500 palabras (validación app-level)
    status = db.Column(db.String(30), default='borrador')

    __table_args__ = (
        db.Index('idx_mreport_center', 'center_id'),
        db.Index('idx_mreport_educator', 'educator_id'),
        db.Index('idx_mreport_type', 'report_type'),
    )

    educator = db.relationship('User', foreign_keys=[educator_id])
    center = db.relationship('Tenant', foreign_keys=[center_id])


class FoodIntakeReception(db.Model, BaseModel):
    """
    Ficha diaria de recepción de alimentos CMCI (§10.3 Módulo D).
    Aporte CMCI 75% en 4 tiempos + Hogar 25%.
    Eficiencia = (ingesta_real / cobertura_total) * 100 (ej. 68/72=94.44).
    Control organoléptico diario (olor/color/sabor) + aceptabilidad
    + 2 entregas (07:00 desayuno+fruta, 11:00 almuerzo+colada)
    + cumplió_menú Sí/No + novedades. Sin firma electrónica.
    """
    __tablename__ = 'food_intake_receptions'

    MEAL_TIMES = ('desayuno', 'refrigerio_am', 'almuerzo', 'refrigerio_pm')
    DELIVERIES = ('07:00', '11:00')

    id = db.Column(db.Integer, primary_key=True)
    center_id = db.Column(db.Integer, db.ForeignKey('tenants.id'), nullable=True)
    date = db.Column(db.Date, nullable=False)
    meal_time = db.Column(db.String(30), nullable=False)  # 1 de MEAL_TIMES

    aporte_cmci_pct = db.Column(db.Float, default=75.0)  # 75% CMCI
    aporte_hogar_pct = db.Column(db.Float, default=25.0)  # 25% hogar
    ingesta_real = db.Column(db.Float)      # raciones efectivamente consumidas
    cobertura_total = db.Column(db.Float)   # raciones planificadas

    olor = db.Column(db.String(20))   # Conforme / NoConforme
    color = db.Column(db.String(20))  # Conforme / NoConforme
    sabor = db.Column(db.String(20))  # Conforme / NoConforme
    aceptabilidad = db.Column(db.String(20))  # Excelente/Buena/Regular/Mala

    entrega = db.Column(db.String(10))  # 07:00 (desayuno+fruta) | 11:00 (almuerzo+colada)
    cumplio_menu = db.Column(db.Boolean)  # Sí/No
    novedades = db.Column(db.Text)

    registered_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    is_snapshot = db.Column(db.Boolean, default=False)  # congelado día 24: solo-lectura

    __table_args__ = (
        db.Index('idx_foodintake_center_date', 'center_id', 'date'),
        db.Index('idx_foodintake_meal', 'meal_time'),
    )

    center = db.relationship('Tenant', foreign_keys=[center_id])
    registrar = db.relationship('User', foreign_keys=[registered_by])

    @property
    def eficiencia(self):
        """Eficiencia ingesta/cobertura en % (None si sin cobertura)."""
        if not self.cobertura_total:
            return None
        try:
            return round((float(self.ingesta_real or 0) / float(self.cobertura_total)) * 100, 2)
        except (ZeroDivisionError, TypeError, ValueError):
            return None

    def to_dict(self):
        return {
            'id': self.id,
            'center_id': self.center_id,
            'date': self.date.isoformat() if self.date else None,
            'meal_time': self.meal_time,
            'aporte_cmci_pct': self.aporte_cmci_pct,
            'aporte_hogar_pct': self.aporte_hogar_pct,
            'ingesta_real': self.ingesta_real,
            'cobertura_total': self.cobertura_total,
            'eficiencia': self.eficiencia,
            'olor': self.olor,
            'color': self.color,
            'sabor': self.sabor,
            'aceptabilidad': self.aceptabilidad,
            'entrega': self.entrega,
            'cumplio_menu': self.cumplio_menu,
            'novedades': self.novedades,
            'is_snapshot': self.is_snapshot,
        }
