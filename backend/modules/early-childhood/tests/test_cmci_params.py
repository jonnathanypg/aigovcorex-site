"""
Fase 0 — Valida seeds/cmci/cmci_params_v1.json contra el plan (§3 + §10.1).
- dims suman 100, global 100±0.05, socio pesos 1.0, 33 indicadores,
  rangos/prios/umbrales presentes, B64/B65/B68 fórmulas presentes, country EC presente.
"""
import json
import os

PARAMS_PATH = os.path.join(
    os.path.dirname(__file__), '..', 'seeds', 'cmci', 'cmci_params_v1.json'
)


def load_params():
    with open(os.path.normpath(PARAMS_PATH), encoding='utf-8') as f:
        return json.load(f)


def test_dims_suman_100():
    p = load_params()
    total = sum(d['weight'] for d in p['vulnerability']['dimensions'])
    assert total == 100, f'dims suman {total}'


def test_global_100():
    p = load_params()
    total = sum(i['weight_global'] for i in p['vulnerability']['indicators'])
    assert abs(total - 100) <= 0.05, f'global suma {total}'


def test_socio_pesos_1():
    p = load_params()
    total = sum(w['w'] for w in p['socioeconomic']['weights'])
    assert abs(total - 1.0) < 1e-9, f'socio suma {total}'


def test_33_indicadores():
    p = load_params()
    inds = p['vulnerability']['indicators']
    assert len(inds) == 33, f'{len(inds)} indicadores'


def test_rangos_prios_umbrales():
    p = load_params()
    v = p['vulnerability']
    assert len(v['ranges']) == 5
    assert len(v['priorities']) == 3
    for k in ('CanastaRef', 'RatioT_100', 'RatioT_075', 'RatioT_050',
              'RatioT_025', 'DepT_1', 'DepT_2', 'DepT_3', 'DepT_4',
              'NnaT_2', 'NnaT_3', 'NnaT_4', 'HacT_2', 'HacT_3'):
        assert k in v['thresholds'], f'falta umbral {k}'


def test_formulas_B64_B65_B68():
    p = load_params()
    fl = p['socioeconomic']['formulas_literales']
    assert 'B64' in fl and 'Empleo formal' in fl['B64'], 'B64 incompleta'
    assert 'B65' in fl and 'Propia' in fl['B65'], 'B65 incompleta'
    assert 'B68' in fl and 'Bachillerato completo' in fl['B68'], 'B68 incompleta'


def test_country_EC():
    p = load_params()
    isos = [c['country_iso'] for c in p['country_configs']]
    assert 'EC' in isos, 'falta country EC'
    ec = next(c for c in p['country_configs'] if c['country_iso'] == 'EC')
    assert ec['phone_prefix'] == '593'
    assert ec['id_validation'] == 'modulo-10'
