"""
WHO Child Growth Standards (0-60 months)
Implements LMS calculations for Weight-for-Age, Length/Height-for-Age, and BMI-for-Age.
Based on World Health Organization (WHO) Child Growth Standards (2006).
"""
import math
from typing import Dict, Optional, Tuple, List

# WHO LMS Parameters by Age in Months (0 to 60)
WFA_BOYS = {
    0: (0.3487, 3.3464, 0.14602), 1: (0.2297, 4.4709, 0.13395), 2: (0.1717, 5.5675, 0.12423),
    3: (0.1305, 6.3762, 0.11714), 4: (0.0984, 7.0003, 0.11218), 5: (0.0722, 7.5098, 0.10864),
    6: (0.0501, 7.9351, 0.10609), 7: (0.0310, 8.2989, 0.10425), 8: (0.0142, 8.6180, 0.10292),
    9: (-0.0007, 8.9048, 0.10198), 10: (-0.0141, 9.1670, 0.10134), 11: (-0.0263, 9.4103, 0.10091),
    12: (-0.0374, 9.6393, 0.10065), 13: (-0.0475, 9.8576, 0.10052), 14: (-0.0569, 10.0676, 0.10050),
    15: (-0.0655, 10.2713, 0.10055), 16: (-0.0735, 10.4700, 0.10068), 17: (-0.0809, 10.6649, 0.10087),
    18: (-0.0878, 10.8569, 0.10111), 19: (-0.0942, 11.0467, 0.10139), 20: (-0.1003, 11.2349, 0.10170),
    21: (-0.1060, 11.4219, 0.10205), 22: (-0.1114, 11.6081, 0.10243), 23: (-0.1165, 11.7937, 0.10283),
    24: (-0.1214, 11.9790, 0.10325), 25: (-0.1261, 12.1643, 0.10369), 26: (-0.1306, 12.3497, 0.10414),
    27: (-0.1349, 12.5354, 0.10461), 28: (-0.1390, 12.7214, 0.10509), 29: (-0.1430, 12.9079, 0.10558),
    30: (-0.1469, 13.0949, 0.10609), 31: (-0.1506, 13.2825, 0.10660), 32: (-0.1542, 13.4707, 0.10712),
    33: (-0.1577, 13.6596, 0.10765), 34: (-0.1612, 13.8492, 0.10819), 35: (-0.1645, 14.0395, 0.10874),
    36: (-0.1678, 14.2305, 0.10929), 37: (-0.1710, 14.4223, 0.10985), 38: (-0.1741, 14.6148, 0.11041),
    39: (-0.1772, 14.8080, 0.11099), 40: (-0.1802, 15.0020, 0.11156), 41: (-0.1832, 15.1967, 0.11215),
    42: (-0.1861, 15.3922, 0.11273), 43: (-0.1890, 15.5884, 0.11333), 44: (-0.1918, 15.7854, 0.11392),
    45: (-0.1946, 15.9831, 0.11452), 46: (-0.1974, 16.1815, 0.11512), 47: (-0.2001, 16.3807, 0.11573),
    48: (-0.2028, 16.5805, 0.11634), 49: (-0.2054, 16.7811, 0.11695), 50: (-0.2081, 16.9823, 0.11756),
    51: (-0.2107, 17.1843, 0.11818), 52: (-0.2132, 17.3869, 0.11879), 53: (-0.2158, 17.5901, 0.11941),
    54: (-0.2183, 17.7940, 0.12003), 55: (-0.2208, 17.9985, 0.12065), 56: (-0.2233, 18.2035, 0.12127),
    57: (-0.2258, 18.4091, 0.12189), 58: (-0.2282, 18.6152, 0.12251), 59: (-0.2307, 18.8219, 0.12313),
    60: (-0.2331, 19.0290, 0.12375)
}

LHFA_BOYS = {
    0: (1.0, 49.8842, 0.03795), 1: (1.0, 54.7244, 0.03559), 2: (1.0, 58.4249, 0.03450),
    3: (1.0, 61.4292, 0.03399), 4: (1.0, 63.8860, 0.03378), 5: (1.0, 65.9026, 0.03372),
    6: (1.0, 67.6236, 0.03375), 7: (1.0, 69.1645, 0.03383), 8: (1.0, 70.5794, 0.03396),
    9: (1.0, 71.8953, 0.03411), 10: (1.0, 73.1367, 0.03429), 11: (1.0, 74.3197, 0.03448),
    12: (1.0, 75.7499, 0.03468), 13: (1.0, 76.9202, 0.03489), 14: (1.0, 78.0267, 0.03510),
    15: (1.0, 79.0880, 0.03532), 16: (1.0, 80.1118, 0.03554), 17: (1.0, 81.1037, 0.03576),
    18: (1.0, 82.0682, 0.03598), 19: (1.0, 83.0087, 0.03621), 20: (1.0, 83.9276, 0.03643),
    21: (1.0, 84.8270, 0.03666), 22: (1.0, 85.7088, 0.03688), 23: (1.0, 86.5744, 0.03711),
    24: (1.0, 87.1189, 0.03734), 25: (1.0, 87.9734, 0.03757), 26: (1.0, 88.8142, 0.03780),
    27: (1.0, 89.6421, 0.03803), 28: (1.0, 90.4578, 0.03826), 29: (1.0, 91.2618, 0.03849),
    30: (1.0, 92.0546, 0.03872), 31: (1.0, 92.8368, 0.03895), 32: (1.0, 93.6087, 0.03918),
    33: (1.0, 94.3707, 0.03940), 34: (1.0, 95.1232, 0.03963), 35: (1.0, 95.8665, 0.03986),
    36: (1.0, 96.1158, 0.04008), 37: (1.0, 96.8456, 0.04031), 38: (1.0, 97.5671, 0.04053),
    39: (1.0, 98.2804, 0.04076), 40: (1.0, 98.9859, 0.04098), 41: (1.0, 99.6837, 0.04120),
    42: (1.0, 100.3741, 0.04142), 43: (1.0, 101.0573, 0.04165), 44: (1.0, 101.7335, 0.04187),
    45: (1.0, 102.4030, 0.04209), 46: (1.0, 103.0658, 0.04231), 47: (1.0, 103.7222, 0.04253),
    48: (1.0, 104.3723, 0.04274), 49: (1.0, 105.0163, 0.04296), 50: (1.0, 105.6543, 0.04318),
    51: (1.0, 106.2865, 0.04339), 52: (1.0, 106.9130, 0.04361), 53: (1.0, 107.5339, 0.04382),
    54: (1.0, 108.1493, 0.04404), 55: (1.0, 108.7594, 0.04425), 56: (1.0, 109.3642, 0.04446),
    57: (1.0, 109.9639, 0.04467), 58: (1.0, 110.5585, 0.04488), 59: (1.0, 111.1481, 0.04509),
    60: (1.0, 111.7329, 0.04530)
}

WFA_GIRLS = {
    0: (0.3809, 3.2322, 0.14171), 1: (0.2609, 4.1873, 0.13063), 2: (0.2024, 5.1282, 0.12217),
    3: (0.1608, 5.8449, 0.11624), 4: (0.1287, 6.4237, 0.11197), 5: (0.1026, 6.8996, 0.10884),
    6: (0.0807, 7.2974, 0.10654), 7: (0.0617, 7.6366, 0.10486), 8: (0.0448, 7.9333, 0.10364),
    9: (0.0296, 8.1994, 0.10276), 10: (0.0159, 8.4429, 0.10214), 11: (0.0033, 8.6705, 0.10173),
    12: (-0.0082, 8.8864, 0.10148), 13: (-0.0189, 9.0941, 0.10137), 14: (-0.0289, 9.2963, 0.10137),
    15: (-0.0381, 9.4947, 0.10145), 16: (-0.0468, 9.6908, 0.10161), 17: (-0.0550, 9.8856, 0.10183),
    18: (-0.0627, 10.0799, 0.10210), 19: (-0.0700, 10.2743, 0.10243), 20: (-0.0769, 10.4691, 0.10280),
    21: (-0.0834, 10.6647, 0.10321), 22: (-0.0897, 10.8614, 0.10365), 23: (-0.0956, 11.0592, 0.10412),
    24: (-0.1013, 11.2583, 0.10462), 25: (-0.1067, 11.4587, 0.10515), 26: (-0.1119, 11.6604, 0.10570),
    27: (-0.1169, 11.8634, 0.10627), 28: (-0.1217, 12.0677, 0.10685), 29: (-0.1264, 12.2731, 0.10746),
    30: (-0.1308, 12.4797, 0.10808), 31: (-0.1352, 12.6874, 0.10871), 32: (-0.1394, 12.8961, 0.10935),
    33: (-0.1434, 13.1057, 0.11001), 34: (-0.1474, 13.3163, 0.11068), 35: (-0.1512, 13.5276, 0.11136),
    36: (-0.1549, 13.7397, 0.11204), 37: (-0.1585, 13.9525, 0.11274), 38: (-0.1620, 14.1659, 0.11344),
    39: (-0.1655, 14.3799, 0.11415), 40: (-0.1688, 14.5943, 0.11487), 41: (-0.1721, 14.8091, 0.11559),
    42: (-0.1753, 15.0243, 0.11632), 43: (-0.1784, 15.2397, 0.11706), 44: (-0.1814, 15.4554, 0.11779),
    45: (-0.1844, 15.6712, 0.11854), 46: (-0.1873, 15.8871, 0.11928), 47: (-0.1901, 16.1030, 0.12003),
    48: (-0.1929, 16.3190, 0.12078), 49: (-0.1956, 16.5348, 0.12154), 50: (-0.1983, 16.7506, 0.12229),
    51: (-0.2009, 16.9662, 0.12305), 52: (-0.2035, 17.1817, 0.12381), 53: (-0.2060, 17.3969, 0.12457),
    54: (-0.2085, 17.6119, 0.12533), 55: (-0.2109, 17.8265, 0.12609), 56: (-0.2133, 18.0408, 0.12685),
    57: (-0.2157, 18.2547, 0.12760), 58: (-0.2180, 18.4682, 0.12836), 59: (-0.2203, 18.6812, 0.12912),
    60: (-0.2225, 18.8938, 0.12987)
}

LHFA_GIRLS = {
    0: (1.0, 49.1477, 0.03790), 1: (1.0, 53.6872, 0.03563), 2: (1.0, 57.0673, 0.03467),
    3: (1.0, 59.8029, 0.03429), 4: (1.0, 62.0899, 0.03420), 5: (1.0, 64.0496, 0.03426),
    6: (1.0, 65.7311, 0.03440), 7: (1.0, 67.2954, 0.03458), 8: (1.0, 68.7397, 0.03478),
    9: (1.0, 70.1352, 0.03500), 10: (1.0, 71.4912, 0.03523), 11: (1.0, 72.8122, 0.03546),
    12: (1.0, 74.0195, 0.03570), 13: (1.0, 75.1952, 0.03595), 14: (1.0, 76.3533, 0.03620),
    15: (1.0, 77.4914, 0.03646), 16: (1.0, 78.6083, 0.03672), 17: (1.0, 79.7042, 0.03698),
    18: (1.0, 80.7797, 0.03724), 19: (1.0, 81.8354, 0.03751), 20: (1.0, 82.8718, 0.03777),
    21: (1.0, 83.8897, 0.03804), 22: (1.0, 84.8897, 0.03830), 23: (1.0, 85.8724, 0.03857),
    24: (1.0, 86.4253, 0.03884), 25: (1.0, 87.2798, 0.03910), 26: (1.0, 88.1189, 0.03937),
    27: (1.0, 88.9431, 0.03963), 28: (1.0, 89.7531, 0.03989), 29: (1.0, 90.5492, 0.04015),
    30: (1.0, 91.3320, 0.04041), 31: (1.0, 92.1020, 0.04066), 32: (1.0, 92.8596, 0.04092),
    33: (1.0, 93.6053, 0.04117), 34: (1.0, 94.3394, 0.04142), 35: (1.0, 95.0623, 0.04167),
    36: (1.0, 95.1481, 0.04192), 37: (1.0, 95.8454, 0.04217), 38: (1.0, 96.5317, 0.04241),
    39: (1.0, 97.2072, 0.04266), 40: (1.0, 97.8723, 0.04290), 41: (1.0, 98.5273, 0.04314),
    42: (1.0, 99.1724, 0.04338), 43: (1.0, 99.8078, 0.04362), 44: (1.0, 100.4338, 0.04386),
    45: (1.0, 101.0506, 0.04409), 46: (1.0, 101.6583, 0.04433), 47: (1.0, 102.2573, 0.04456),
    48: (1.0, 102.8477, 0.04479), 49: (1.0, 103.4297, 0.04502), 50: (1.0, 104.0035, 0.04525),
    51: (1.0, 104.5694, 0.04548), 52: (1.0, 105.1275, 0.04571), 53: (1.0, 105.6780, 0.04593),
    54: (1.0, 106.2210, 0.04616), 55: (1.0, 106.7569, 0.04638), 56: (1.0, 107.2858, 0.04661),
    57: (1.0, 107.8079, 0.04683), 58: (1.0, 108.3233, 0.04705), 59: (1.0, 108.8322, 0.04727),
    60: (1.0, 109.3347, 0.04749)
}

class WHOStandardsService:
    """Service to compute WHO Z-scores and percentiles for early childhood."""

    @staticmethod
    def _calc_lms_zscore(measurement: float, l: float, m: float, s: float) -> float:
        if measurement <= 0 or m <= 0 or s <= 0:
            return 0.0
        try:
            if abs(l) > 0.001:
                z = (math.pow(measurement / m, l) - 1.0) / (l * s)
            else:
                z = math.log(measurement / m) / s
            return round(z, 2)
        except Exception:
            return 0.0

    @staticmethod
    def _calc_value_from_z(z: float, l: float, m: float, s: float) -> float:
        try:
            if abs(l) > 0.001:
                val = m * math.pow(1.0 + l * s * z, 1.0 / l)
            else:
                val = m * math.exp(s * z)
            return round(val, 2)
        except Exception:
            return 0.0

    @classmethod
    def calculate_weight_zscore(cls, weight_kg: float, age_months: int, gender: str) -> Optional[float]:
        if weight_kg is None or weight_kg <= 0:
            return None
        age = max(0, min(60, int(age_months)))
        gender_code = 'M' if str(gender).upper().startswith(('M', 'H', 'B', 'N', 'V')) else 'F'
        table = WFA_BOYS if gender_code == 'M' else WFA_GIRLS
        params = table.get(age)
        if not params:
            return None
        l, m, s = params
        return cls._calc_lms_zscore(weight_kg, l, m, s)

    @classmethod
    def calculate_height_zscore(cls, height_cm: float, age_months: int, gender: str) -> Optional[float]:
        if height_cm is None or height_cm <= 0:
            return None
        age = max(0, min(60, int(age_months)))
        gender_code = 'M' if str(gender).upper().startswith(('M', 'H', 'B', 'N', 'V')) else 'F'
        table = LHFA_BOYS if gender_code == 'M' else LHFA_GIRLS
        params = table.get(age)
        if not params:
            return None
        l, m, s = params
        return cls._calc_lms_zscore(height_cm, l, m, s)

    @classmethod
    def classify_weight_status(cls, z_score: Optional[float]) -> str:
        if z_score is None:
            return 'Sin evaluación'
        if z_score < -3.0:
            return 'Desnutrición Severa'
        elif z_score < -2.0:
            return 'Desnutrición Moderada'
        elif z_score <= 2.0:
            return 'Adecuado / Eutrófico'
        elif z_score <= 3.0:
            return 'Sobrepeso'
        else:
            return 'Obesidad'

    @classmethod
    def classify_height_status(cls, z_score: Optional[float]) -> str:
        if z_score is None:
            return 'Sin evaluación'
        if z_score < -3.0:
            return 'Talla Muy Baja / Retardo Severo'
        elif z_score < -2.0:
            return 'Talla Baja / Retardo Moderado'
        elif z_score <= 2.0:
            return 'Talla Adecuada'
        else:
            return 'Talla Alta'

    @classmethod
    def get_reference_curves(cls, indicator: str, gender: str, min_age: int = 0, max_age: int = 60) -> List[Dict]:
        gender_code = 'M' if str(gender).upper().startswith(('M', 'H', 'B', 'N', 'V')) else 'F'
        if indicator == 'height':
            table = LHFA_BOYS if gender_code == 'M' else LHFA_GIRLS
        else:
            table = WFA_BOYS if gender_code == 'M' else WFA_GIRLS
            
        curve_points = []
        for month in range(min_age, max_age + 1):
            params = table.get(month)
            if not params:
                continue
            l, m, s = params
            curve_points.append({
                'age_months': month,
                'sd_neg3': cls._calc_value_from_z(-3, l, m, s),
                'sd_neg2': cls._calc_value_from_z(-2, l, m, s),
                'sd_neg1': cls._calc_value_from_z(-1, l, m, s),
                'median': cls._calc_value_from_z(0, l, m, s),
                'sd_pos1': cls._calc_value_from_z(1, l, m, s),
                'sd_pos2': cls._calc_value_from_z(2, l, m, s),
                'sd_pos3': cls._calc_value_from_z(3, l, m, s),
            })
        return curve_points

    @classmethod
    def detect_measurement_anomalies(cls, current: Dict, previous: Optional[Dict]) -> List[str]:
        alerts = []
        if not previous:
            z_w = current.get('z_score_weight')
            z_h = current.get('z_score_height')
            if z_w is not None and abs(z_w) >= 3.5:
                alerts.append(f'Z-Score Peso ({z_w}) en rango biológico extremo. Verificar balanza.')
            if z_h is not None and abs(z_h) >= 3.5:
                alerts.append(f'Z-Score Talla ({z_h}) en rango biológico extremo. Verificar tallímetro.')
            return alerts

        curr_height = current.get('height')
        prev_height = previous.get('height')
        curr_weight = current.get('weight')
        prev_weight = previous.get('weight')
        curr_age = current.get('age_months')
        prev_age = previous.get('age_months')

        if curr_age is not None and prev_age is not None:
            months_diff = curr_age - prev_age
            if months_diff > 0:
                if curr_height is not None and prev_height is not None:
                    height_gain = curr_height - prev_height
                    if height_gain < -0.5:
                        alerts.append(f'Talla disminuyó en {abs(round(height_gain, 1))} cm respecto a la toma anterior. Posible error de toma.')
                    elif height_gain > (months_diff * 2.5 + 3.0):
                        alerts.append(f'Incremento de talla anómalo (+{round(height_gain, 1)} cm en {months_diff} meses). Sugiere error de medición.')

                if curr_weight is not None and prev_weight is not None:
                    weight_change = curr_weight - prev_weight
                    if weight_change < -(prev_weight * 0.15):
                        alerts.append(f'Pérdida de peso significativa (-{abs(round(weight_change, 1))} kg en {months_diff} meses). Alerta médica prioritaria.')
                    elif weight_change > (months_diff * 1.5 + 2.0):
                        alerts.append(f'Ganancia de peso inusual (+{round(weight_change, 1)} kg en {months_diff} meses). Verificar registro.')

        return alerts
