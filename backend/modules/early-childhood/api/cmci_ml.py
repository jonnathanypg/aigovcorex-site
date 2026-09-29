"""
F2 — ML shadow explain API (sin firma electrónica).

TODO FUSIÓN: cuando F1 cree `api/cmci.py`, fusionar este blueprint allí
(`cmci_bp.route('/vulnerability/<id>/ml-explain')`) y eliminar este archivo,
manteniendo el contrato de respuesta. Registrar en app.py con
url_prefix='/api/cmci' hasta entonces.

Contrato: el ML es shadow — informa proba/top3/versionado pero NUNCA
modifica el total determinista (delta siempre 0.0).
"""
from flask import Blueprint, jsonify
from middleware.tenant_context import tenant_required, TenantContext
import logging

logger = logging.getLogger(__name__)

cmci_ml_bp = Blueprint('cmci_ml', __name__)


@cmci_ml_bp.route('/vulnerability/<int:assessment_id>/ml-explain', methods=['GET'])
@tenant_required  # F5: exige tenant + habilita IDOR (antes solo jwt)
def ml_explain(assessment_id: int):
    """Explica el shadow ML de una ficha de vulnerabilidad CMCI.

    Retorna {ml_priority_proba, top3, determinista_total, delta,
    ml_version, mode}. Si no hay modelo o la ficha no tiene proba
    persistida, recalcula shadow al vuelo (sin persistir ni alterar nada).
    """
    try:
        from models.cmci import VulnerabilityAssessment
        from services.ml_calibrator import calibrate, explain_for_assessment

        rec = VulnerabilityAssessment.query.get(assessment_id)
        if not rec:
            return jsonify({'success': False,
                            'error': 'Ficha no encontrada'}), 404
        # F5 IDOR: la ficha debe pertenecer al tenant (site==tenant).
        tenant_id = TenantContext.get_current_tenant_id()
        if getattr(rec, 'center_id', None) not in (None, tenant_id):
            return jsonify({'success': False,
                            'error': 'Ficha no encontrada'}), 404

        proba = getattr(rec, 'ml_proba', None)
        ml_version = getattr(rec, 'ml_version', None)
        top3 = None
        if proba is None:
            # Recálculo shadow al vuelo (solo lectura, sin persistir)
            fd = dict(getattr(rec, 'answers', None) or {})
            fd['subtotals'] = getattr(rec, 'subtotals', None) or {}
            fd['scores'] = getattr(rec, 'scores', None) or {}
            fd['alerts'] = getattr(rec, 'alerts', None) or {}
            _, info = calibrate(None, fd, getattr(rec, 'total', 0.0) or 0.0)
            proba = info.get('proba')
            top3 = info.get('top3', [])
            ml_version = info.get('ml_version')
        payload = explain_for_assessment(getattr(rec, 'total', 0.0) or 0.0,
                                         proba, top3=top3, ml_version=ml_version)
        payload['success'] = True
        payload['assessment_id'] = assessment_id
        return jsonify(payload), 200
    except Exception as e:
        logger.error(f'ml-explain fallo: {e}')
        return jsonify({'success': False, 'error': str(e)}), 500
