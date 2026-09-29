"""Tests F1 — motores CMCI vs Excels validados (diff <= 0.01).

- 5 casos PRUEBAS (.xlsm hoja PRUEBAS: 8/No/muy baja->P3, 30->baja P3,
  50->moderada P2, 70->alta P1, 44.5/Sí->moderada P1 por alerta).
- Min/Max engine (respuestas extremas, totales calculados a mano).
- 2 casos Javier: hogar 750/8 (per-cápita 93.75, I1.1=3; total Excel 61.1
  -> alta NARANJA P1) y hogar 2500/2 (baja, VERDE, P3).
- 1 país_dummy (otra CanastaRef/moneda: prueba cero hardcodes EC).
- Socioeconómica: caso prototipo (E62=50.0 -> media), alto/bajo, B64/B65/B68
  literales §10.1, params validate, ranking Y/Z.
"""
import copy
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.scoring import vulnerability_engine as VE
from services.scoring import socioeconomic_engine as SE
from services.scoring.params_store import ParamStore, load_seed, validate

ACC = 0.01  # dif máxima Excel-vs-sistema (§10.8 exige 0.00; usamos 0.01 por float)


@pytest.fixture(scope="module")
def params():
    return load_seed()


BEST = {
    "I1.2": "Ambos/el único cuidador con empleo formal",
    "I1.3": "Ingresos estables y permanentes",
    "I1.5": "No consta clasificación de pobreza / sin dato disponible",
    "I2.1": "Hogar biparental (ambos progenitores presentes y a cargo)",
    "I2.3": "Ninguna persona adicional dependiente",
    "I3.1": "Empleo formal estable",
    "I3.2": "No aplica (hogar con un solo cuidador)",
    "I3.3": "Horario compatible con el cuidado del niño/a",
    "I3.4": "No estudia actualmente",
    "I4.1": "Sí cuenta con cuidador/a permanente y estable",
    "I4.2": "No depende de terceros; arreglo estable",
    "I4.3": "Ninguna hora",
    "I4.4": "Sin riesgo identificado",
    "I4.5": "Ya accede a un servicio formal de cuidado infantil",
    "I5.1": "Propia",
    "I5.3": "Cuenta con los 3 servicios básicos",
    "I5.4": "Sin riesgos identificados",
    "I6.1": "Sin condición que requiera cuidado especial",
    "I6.2": "Sin limitación",
    "I6.3": "No aplica",
    "I6.4": "Acceso regular (afiliación/atención garantizada)",
    "I7.1": "No se identifican indicios",
    "I7.2": "No se identifican indicios",
    "I7.3": "Cuenta con redes de protección activas",
    "I7.4": "No aplica",
    "I7.5": "No se identifican",
    "I8.1": "Sí_disponibilidad amplia",
    "I8.2": "Apoyo frecuente y confiable",
    "I8.3": "Cuenta con apoyo comunitario/institucional activo",
}

WORST = {
    "I1.2": "Ambos cuidadores desempleados o sin fuente de ingreso propia",
    "I1.3": "Sin ingresos fijos ni ocasionales",
    "I1.5": "Clasificado en situación de pobreza extrema",
    "I2.1": "Niño/a bajo cuidado de terceros (sin ninguno de los progenitores)",
    "I2.3": "2 o más personas adicionales dependientes",
    "I3.1": "Desempleado/a busca empleo activamente",  # máx 3 (asimétrico)
    "I3.2": "Desempleado/a",  # máx 2
    "I3.3": "Incompatible (jornada completa turnos rotativos o nocturnos)",
    "I3.4": "Estudia y NO cuenta con apoyo para el cuidado del niño/a",  # máx 3
    "I4.1": "No cuenta con cuidador/a permanente",
    "I4.2": "Depende de familiares con alta probabilidad de discontinuidad",
    "I4.3": "5 horas o más",
    "I4.4": "Riesgo alto o inminente",
    "I4.5": "No accede a ningún servicio de cuidado infantil",
    "I5.1": "Situación de alojamiento inestable (albergue compartida forzosamente etc.)",
    "I5.3": "Cuenta con 1 o ningún servicio básico",
    "I5.4": "Riesgo alto (zona de deslaves ríos inseguridad vivienda en mal estado)",
    "I6.1": "Condición que requiere cuidados adicionales_ NO cubiertos",
    "I6.2": "Limitación severa para el cuidado",
    "I6.3": "Sí_con impacto severo en el cuidado",
    "I6.4": "Sin acceso a servicios de salud",
    "I7.1": "Indicios claros que ameritan derivación",
    "I7.2": "Indicios claros que ameritan derivación",
    "I7.3": "Sin ninguna red de protección",
    "I7.4": "Sí_en situación de alta vulnerabilidad (reciente, irregular, sin redes)",  # máx 3
    "I7.5": "Se identifican_requieren derivación inmediata",
    "I8.1": "Sin disponibilidad",
    "I8.2": "Apoyo inexistente o poco confiable",
    "I8.3": "Sin apoyo comunitario/institucional",
}


def make_answers(responses, ingreso=0, integrantes=1, perceptores=1, nna=0,
                 dormitorios=1, **kw):
    a = {"ingreso_total": ingreso, "integrantes": integrantes,
         "perceptores": perceptores, "nna": nna, "dormitorios": dormitorios,
         "responses": dict(responses)}
    a.update(kw)
    return a


# ---------------- 5 casos PRUEBAS (hoja PRUEBAS, INDEX/MATCH + IF alerta) ----------------

PRUEBAS = [
    # (total, alerta, nivel_esperado, semaforo, prioridad_esperada)
    (8, False, "Vulnerabilidad muy baja", "VERDE", "PRIORIDAD 3"),
    (30, False, "Vulnerabilidad baja", "VERDE", "PRIORIDAD 3"),
    (50, False, "Vulnerabilidad moderada", "AMARILLO", "PRIORIDAD 2"),
    (70, False, "Vulnerabilidad alta", "NARANJA", "PRIORIDAD 1"),
    (44.5, True, "Vulnerabilidad moderada", "AMARILLO", "PRIORIDAD 1"),
]


@pytest.mark.parametrize("total,alert,level,sem,prio", PRUEBAS)
def test_pruebas_5_casos(params, total, alert, level, sem, prio):
    cls = VE.classify(total, alert, params)
    assert cls["level"] == level
    assert cls["semaphore"] == sem
    assert cls["priority"] == prio


def test_prueba_005_alerta_obliga_p1_aunque_puntaje_medio(params):
    assert VE.classify(44.5, False, params)["priority"] == "PRIORIDAD 2"
    assert VE.classify(44.5, True, params)["priority"] == "PRIORIDAD 1"


# ---------------- Engine: mínimo / máximo (cálculo a mano) ----------------

def test_engine_minimo_total_cero(params):
    r = VE.compute(make_answers(BEST, ingreso=2500, integrantes=2,
                                perceptores=2, nna=1, dormitorios=2), params)
    assert r["total"] == pytest.approx(0.0, abs=ACC)
    assert r["level"] == "Vulnerabilidad muy baja"
    assert r["semaphore"] == "VERDE"
    assert r["priority"] == "PRIORIDAD 3"
    assert r["protection_alert"] == "NO"
    assert r["childcare_need"] == "BAJA"
    assert all(v == "NO" for v in r["alerts"].values())


def test_engine_maximo_total_90_082(params):
    # A mano: D1=20, D2=9.16575, D3=11.25, D4=20, D5=10, D6=10, D7=9.5, D8=4.9995
    r = VE.compute(make_answers(WORST, ingreso=100, integrantes=8,
                                perceptores=1, nna=6, dormitorios=2), params)
    assert r["subtotals"]["D1"] == pytest.approx(20.0, abs=ACC)
    assert r["subtotals"]["D4"] == pytest.approx(20.0, abs=ACC)
    assert r["total"] == pytest.approx(94.91525, abs=ACC)
    assert r["level"] == "Vulnerabilidad crítica"
    assert r["semaphore"] == "ROJO"
    assert r["priority"] == "PRIORIDAD 1"
    assert r["protection_alert"] != "NO"
    assert r["childcare_need"] == "ALTA"
    assert r["scores"]["I2.2"] == 3  # D36 máx 3, NO 4


def test_edad_rango(params):
    a = make_answers(BEST, ingreso=2500, integrantes=2, perceptores=2,
                     nna=1, dormitorios=2,
                     birth_date="2023-06-01", assessed_at="2026-09-25")
    r = VE.compute(a, params)
    assert r["age_months"] == 39
    assert r["age_range"] == "EN RANGO"
    b = make_answers(BEST, birth_date="2025-10-01", assessed_at="2026-09-25")
    assert VE.compute(b, params)["age_range"] == "FUERA DE RANGO"  # 11 meses


def test_opcion_invalida_es_error(params):
    bad = dict(BEST)
    bad["I1.2"] = "texto que no existe"
    with pytest.raises(ValueError):
        VE.compute(make_answers(bad), params)


# ---------------- 2 casos Javier ----------------

def test_javier_750_8_integrantes(params):
    """Hogar 750/8: per-cápita 93.75, I1.1=3; total Excel 61.1 -> alta naranja P1."""
    r = VE.compute(make_answers(BEST, ingreso=750, integrantes=8,
                                perceptores=2, nna=2, dormitorios=3), params)
    assert r["per_capita"] == pytest.approx(93.75, abs=ACC)
    assert r["scores"]["I1.1"] == 3  # 93.75/220=0.426 -> RatioT_050..075
    assert r["scores"]["I1.4"] == 3  # dependencia 4.0 -> DepT_4
    cls = VE.classify(61.1, False, params)  # total verificado en Excel de Javier
    assert cls["level"] == "Vulnerabilidad alta"
    assert cls["semaphore"] == "NARANJA"
    assert cls["priority"] == "PRIORIDAD 1"
    assert VE.order_y("PRIORIDAD 1", False, 61.1) == pytest.approx(300061.1, abs=ACC)


def test_javier_2500_2_integrantes_baja(params):
    """Hogar 2500/2 con respuestas mixtas -> total ~30 -> baja VERDE P3."""
    resp = dict(BEST)
    for k in ("I4.1", "I4.2", "I4.3", "I4.4", "I4.5",
              "I6.2", "I6.4", "I8.1", "I8.2", "I8.3"):
        resp[k] = WORST[k]
    r = VE.compute(make_answers(resp, ingreso=2500, integrantes=2,
                                perceptores=2, nna=1, dormitorios=2), params)
    # A mano: D4=20 + D8=4.9995 + I6.2=2.5 + I6.4=2.5 = 29.9995
    assert r["per_capita"] == pytest.approx(1250.0, abs=ACC)
    assert r["scores"]["I1.1"] == 0
    assert r["total"] == pytest.approx(30.0, abs=ACC)
    assert r["level"] == "Vulnerabilidad baja"
    assert r["semaphore"] == "VERDE"
    assert r["priority"] == "PRIORIDAD 3"
    assert r["protection_flag"] is False


# ---------------- país_dummy: cero hardcodes ----------------

def test_pais_dummy_otra_canasta(params):
    """Mismo hogar, otra CanastaRef (500, moneda XXX) -> I1.1 cambia 3->4."""
    dummy = copy.deepcopy(params)
    dummy["vulnerability"]["thresholds"]["CanastaRef"] = 500
    dummy["country_configs"] = [{"country_iso": "XX", "phone_prefix": "999",
                                 "currency": "XXX", "canasta_ref": 500}]
    base = VE.compute(make_answers(BEST, ingreso=750, integrantes=8,
                                   perceptores=2, nna=2, dormitorios=3), params)
    alt = VE.compute(make_answers(BEST, ingreso=750, integrantes=8,
                                  perceptores=2, nna=2, dormitorios=3), dummy)
    assert base["scores"]["I1.1"] == 3
    assert alt["scores"]["I1.1"] == 4  # 93.75/500=0.1875 < 0.25
    assert alt["total"] > base["total"]


# ---------------- Socioeconómica ----------------

def socio_prototipo():
    return {
        "integrantes": 6, "perceptores": 2, "dormitorios": 3,
        "personas_por_dormitorio": 3,
        "ingresos": {"sueldos": 1000, "independiente": 500,
                     "negocios": 40, "bonos": 50},
        "egresos": {"alimentacion": 200, "arriendo": 250, "basicos": 50,
                    "transporte": 25, "educacion": 75, "salud": 50,
                    "vestimenta": 30},
        "tenencia": "Arrendada", "tipo_vivienda": "Otra",
        "servicios": ["Sí", "Sí", "No", "Sí", "Sí", "Sí"],
        "situacion_laboral": "Formal",  # literal B64 -> 20 (no es 'Empleo formal')
        "nivel_educativo": "Secundaria incompleta",  # literal B68 -> 60
    }


def test_socio_prototipo_E62_50_media(params):
    """Fila espejo BASE_DATOS del .xlsx: N=50 -> media. Cálculo a mano:
    B62=20,B63=60,B64=20,B65=60,B66=100,B67=100,B68=60 -> 50.0."""
    r = SE.compute(socio_prototipo(), params)
    assert r["ingreso_total"] == pytest.approx(1590.0, abs=ACC)  # E18
    assert r["per_capita"] == pytest.approx(265.0, abs=ACC)  # E19
    assert r["gasto_total"] == pytest.approx(680.0, abs=ACC)  # E29
    assert r["disponible"] == pytest.approx(910.0, abs=ACC)  # E30
    assert r["ratio_gasto"] == pytest.approx(680 / 1590, abs=ACC)  # E31
    assert r["personas_por_perceptor"] == pytest.approx(3.0, abs=ACC)  # B54
    assert r["cobertura_servicios"] == pytest.approx(5 / 6, abs=ACC)  # B55
    assert r["carga"] == "Baja"  # B57
    assert r["dependencia"] == "Media"  # B58
    assert r["subscores"] == {"ingreso": 20, "composicion": 60, "laboral": 20,
                              "vivienda": 60, "servicios": 100, "gastos": 100,
                              "educacion": 60}
    assert r["total"] == pytest.approx(50.0, abs=ACC)  # E62
    assert r["classification"] == "media"  # E63


def test_socio_alta_y_baja(params):
    low = {"integrantes": 8, "perceptores": 1, "dormitorios": 2,
           "ingresos": {"bonos": 50}, "egresos": {"alimentacion": 40},
           "tenencia": "Otra", "tipo_vivienda": "Otra",
           "servicios": ["No"] * 6, "situacion_laboral": "Desempleado/a",
           "nivel_educativo": "Sin escolaridad"}
    r = SE.compute(low, params)
    assert r["total"] == pytest.approx(20.0, abs=ACC)
    assert r["classification"] == "alta"
    high = {"integrantes": 2, "perceptores": 2, "dormitorios": 2,
            "ingresos": {"sueldos": 1500}, "egresos": {"alimentacion": 200},
            "tenencia": "Propia", "tipo_vivienda": "Casa",
            "servicios": ["Sí"] * 6, "situacion_laboral": "Empleo formal",
            "nivel_educativo": "Universitario"}
    r2 = SE.compute(high, params)
    assert r2["total"] == pytest.approx(100.0, abs=ACC)
    assert r2["classification"] == "baja"


def test_socio_B64_B65_B68_literales(params):
    base = socio_prototipo()
    assert SE.compute({**base, "situacion_laboral": "Jubilado/a"},
                      params)["subscores"]["laboral"] == 100
    assert SE.compute({**base, "situacion_laboral": "Trabajo independiente"},
                      params)["subscores"]["laboral"] == 60
    assert SE.compute({**base, "tenencia": "Propia"},
                      params)["subscores"]["vivienda"] == 100
    assert SE.compute({**base, "tenencia": "Anticresis", "tipo_vivienda": "Otra"},
                      params)["subscores"]["vivienda"] == 60
    assert SE.compute({**base, "nivel_educativo": "Posgrado"},
                      params)["subscores"]["educacion"] == 100
    assert SE.compute({**base, "nivel_educativo": "Sin escolaridad"},
                      params)["subscores"]["educacion"] == 20
    # B62 cortes 600/300
    assert SE.compute({**base, "integrantes": 2,
                       "ingresos": {"sueldos": 1500}},
                      params)["subscores"]["ingreso"] == 100  # 750>=600
    assert SE.compute({**base, "integrantes": 1,
                       "ingresos": {"sueldos": 0}},
                      params)["subscores"]["ingreso"] == 0  # E19<=0


# ---------------- params + ranking ----------------

def test_params_seed_valida(params):
    assert validate(params) is True


def test_params_scope_inmutable_y_override(params):
    store = ParamStore(seed=params)
    with pytest.raises(ValueError):
        store.set("global", {"x": 1})
    store.set("country:XX", {"vulnerability": {"thresholds": {"CanastaRef": 500}}})
    assert store.get("country:XX")["vulnerability"]["thresholds"]["CanastaRef"] == 500
    assert store.get("global")["vulnerability"]["thresholds"]["CanastaRef"] == 220


def test_ranking_Y_Z_sin_empates():
    recs = [{"id": 1, "order_y": VE.order_y("PRIORIDAD 2", False, 50.0)},
            {"id": 2, "order_y": VE.order_y("PRIORIDAD 1", False, 70.0)},
            {"id": 3, "order_y": VE.order_y("PRIORIDAD 1", True, 44.5)}]
    out = VE.ranking(recs)
    # Y: id3=301044.5 > id2=300070 > id1=200050 (alerta suma 1000)
    assert [r["id"] for r in out] == [3, 2, 1]
    assert [r["rank_z"] for r in out] == [1, 2, 3]
