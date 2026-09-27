"""Motor socioeconómico — réplica exacta §3.2 + §10.1 del plan.

REGISTRO_SOCIOECONOMICO del .xlsx prototipo v2 (mayor puntaje = mejor condición):
- E18 SUM ingresos (B18:B25) · E19 per-cápita E18/E4 · E29 SUM egresos (B29:B38)
- E30 disponible E18-E29 · E31 ratio E29/E18
- B54 personas/perceptor E4/E12 · B55 cobertura COUNTIF(B45:B50,'Sí')/6
- B56 personas/dormitorio · B57 carga · B58 dependencia
- B62 ingreso (cortes 600/300) · B63 composición · B64 laboral literal §10.1
- B65 vivienda literal §10.1 · B66 servicios · B67 gastos · B68 educación literal §10.1
- E62 SUMPRODUCT(B62:B68, pesos) · E63 <50 alta / <75 media / else baja
"""
from .vulnerability_engine import age_months, in_range

INCOME_KEYS = ("sueldos", "jornales", "independiente", "negocios",
               "pensiones", "bonos", "ayudas", "otros")  # B18:B25
EXPENSE_KEYS = ("alimentacion", "arriendo", "basicos", "transporte", "educacion",
                "salud", "cuidado", "deudas", "vestimenta", "otros")  # B29:B38


def _get(mapping, key, default=0):
    try:
        return float((mapping or {}).get(key, default) or 0)
    except (TypeError, ValueError):
        return 0.0


def compute(data, params):
    """compute(data, params) -> dict con E18-E31, B54-B68, E62/E63."""
    socio = params["socioeconomic"]
    weights = [w["w"] for w in socio["weights"]]  # 7 pesos, suman 1.0
    th = socio["thresholds"]

    integrantes = int(data.get("integrantes") or 0)  # E4
    perceptores = int(data.get("perceptores") or 0)  # E12
    dormitorios = int(data.get("dormitorios") or 0)  # E13

    ingresos = data.get("ingresos") or {}
    egresos = data.get("egresos") or {}
    e18 = sum(_get(ingresos, k) for k in INCOME_KEYS)  # E18
    e19 = e18 / integrantes if integrantes > 0 else 0.0  # E19
    e29 = sum(_get(egresos, k) for k in EXPENSE_KEYS)  # E29
    e30 = e18 - e29  # E30
    e31 = e29 / e18 if e18 > 0 else 0.0  # E31

    servicios = data.get("servicios") or []  # B45:B50, lista de 'Sí'/'No'
    b54 = integrantes / perceptores if perceptores > 0 else 0.0  # B54
    b55 = sum(1 for s in servicios[:6] if s == "Sí") / 6.0  # B55
    if data.get("personas_por_dormitorio") not in (None, ""):
        b56 = float(data["personas_por_dormitorio"])  # B56 explícito
    else:
        b56 = integrantes / dormitorios if dormitorios > 0 else 0.0
    if e31 >= th["carga_alta"]:
        b57 = "Alta"
    elif e31 >= th["carga_media"]:
        b57 = "Media"
    else:
        b57 = "Baja"
    if b54 >= 4:
        b58 = "Alta"
    elif b54 >= 2:
        b58 = "Media"
    else:
        b58 = "Baja"

    b62 = _b62(e19, th)  # cortes 600/300
    b63 = 100 if b58 == "Baja" else (60 if b58 == "Media" else 20)
    b64 = _b64(data.get("situacion_laboral"))  # literal §10.1
    b65 = _b65(data.get("tenencia"), data.get("tipo_vivienda"))  # literal §10.1
    b66 = 100 if b55 >= 0.8 else (60 if b55 >= 0.5 else 20)
    b67 = 100 if e31 < th["carga_media"] else (60 if e31 < th["carga_alta"] else 20)
    b68 = _b68(data.get("nivel_educativo"))  # literal §10.1

    subscores = [b62, b63, b64, b65, b66, b67, b68]
    e62 = sum(s * w for s, w in zip(subscores, weights))  # E62 SUMPRODUCT
    if e62 < 50:
        e63 = "alta"
    elif e62 < 75:
        e63 = "media"
    else:
        e63 = "baja"

    months = age_months(data.get("birth_date"), data.get("assessed_at"))

    return {
        "ingreso_total": e18,  # E18
        "per_capita": e19,  # E19
        "gasto_total": e29,  # E29
        "disponible": e30,  # E30
        "ratio_gasto": e31,  # E31
        "personas_por_perceptor": b54,  # B54
        "cobertura_servicios": b55,  # B55
        "personas_por_dormitorio": b56,  # B56
        "carga": b57,  # B57
        "dependencia": b58,  # B58
        "subscores": {"ingreso": b62, "composicion": b63, "laboral": b64,
                      "vivienda": b65, "servicios": b66, "gastos": b67,
                      "educacion": b68},  # B62:B68
        "total": e62,  # E62
        "classification": e63,  # E63
        "label": f"Vulnerabilidad socioeconómica {e63}",
        "age_months": months,
        "age_range": in_range(months),
    }


def _b62(e19, th):
    """B62 = IF(E19<=0,0,IF(E19>=600,100,IF(E19>=300,60,20)))."""
    if e19 <= 0:
        return 0
    if e19 >= th["corte_ingreso_alto"]:
        return 100
    if e19 >= th["corte_ingreso_medio"]:
        return 60
    return 20


def _b64(situacion_laboral):
    """B64 literal §10.1 (NO simplificar a 'formal=100' genérico)."""
    e42 = (situacion_laboral or "")
    if e42 in ("Empleo formal", "Jubilado/a"):
        return 100
    if e42 in ("Empleo informal", "Trabajo independiente"):
        return 60
    return 20


def _b65(tenencia, tipo_vivienda):
    """B65 literal §10.1."""
    b42, b43 = (tenencia or ""), (tipo_vivienda or "")
    if b42 == "Propia" or b43 in ("Casa", "Departamento"):
        return 100
    if b42 in ("Arrendada", "Prestada/Cedida", "Anticresis"):
        return 60
    return 20


def _b68(nivel_educativo):
    """B68 literal §10.1."""
    e43 = (nivel_educativo or "")
    if e43 in ("Bachillerato completo", "Técnico/tecnológico",
               "Universitario", "Posgrado"):
        return 100
    if e43 == "Sin escolaridad":
        return 20
    return 60
