"""explain: traza auditable por indicador (determinista vs Excel, celda por celda)."""
from .vulnerability_engine import ROW_INDICATOR, DIM_ROWS


def explain_vulnerability(result, answers, params):
    """Una fila por indicador: respuesta, score 0-4, peso global, aporte G."""
    weights = {i["id"]: i["weight_global"] for i in params["vulnerability"]["indicators"]}
    dims = {i["id"]: i["dim"] for i in params["vulnerability"]["indicators"]}
    responses = (answers or {}).get("responses") or {}
    rows = []
    for row in sorted(ROW_INDICATOR):
        ind = ROW_INDICATOR[row]
        auto_val = (result.get("calc_values") or {}).get(ind)
        rows.append({
            "row": row,
            "indicator": ind,
            "dim": dims.get(ind),
            "response": responses.get(ind) if auto_val is None else f"auto={round(auto_val, 4)}",
            "score": result["scores"][ind],
            "weight_global": weights.get(ind),
            "contrib": round(result["contrib"][ind], 4),
        })
    by_dim = {d: round(v, 4) for d, v in result["subtotals"].items()}
    return {"rows": rows, "subtotals": by_dim, "total": round(result["total"], 4),
            "level": result["level"], "priority": result["priority"],
            "protection_alert": result["protection_alert"]}


def explain_socioeconomic(result):
    """Traza E18-E31, B54-B68, E62/E63."""
    return {
        "ingreso_total_E18": result["ingreso_total"],
        "per_capita_E19": round(result["per_capita"], 4),
        "gasto_total_E29": result["gasto_total"],
        "disponible_E30": result["disponible"],
        "ratio_gasto_E31": round(result["ratio_gasto"], 4),
        "indicadores": {
            "B54_personas_por_perceptor": round(result["personas_por_perceptor"], 4),
            "B55_cobertura": round(result["cobertura_servicios"], 4),
            "B56_personas_por_dormitorio": result["personas_por_dormitorio"],
            "B57_carga": result["carga"],
            "B58_dependencia": result["dependencia"],
        },
        "subpuntajes_B62_B68": result["subscores"],
        "total_E62": round(result["total"], 4),
        "clasificacion_E63": result["classification"],
    }
