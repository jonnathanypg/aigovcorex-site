"""
Milestones Catalog - Catálogo Oficial de Hitos IDII (MIES/CMCI)
Transcrito fielmente de la Ficha de Indicadores del Desarrollo Infantil Integral.

Ámbitos de Aprendizaje:
  1. Vinculación Emocional y Social
  2. Exploración del Cuerpo y Motricidad
  3. Lenguaje Verbal y No Verbal
  4. Descubrimiento del Medio Natural y Cultural

Escala de Evaluación (Colores):
  🔴 Rojo = Requiere Apoyo (no_iniciado) = 0%
  🟡 Amarillo = En Desarrollo (en_proceso) = 50%
  🟢 Verde = Logro Alcanzado (adquirido) = 100%
"""

MILESTONES_CATALOG = {
    "0-12": {
        "name": "0 a 12 meses",
        "age_range_label": "0 meses a 12 meses y 15 días",
        "milestones": {
            "vinculacion_emocional": [
                "Reconoce a sus cuidadores principales",
                "Sonríe en respuesta a estímulos sociales",
                "Muestra preferencia por personas familiares",
                "Expresa emociones básicas (alegría, tristeza, enojo)",
                "Se aferra a su cuidador principal en lugares desconocidos"
            ],
            "expresion_corporal": [
                "Sostiene la cabeza",
                "Se sienta con apoyo",
                "Gatea o se arrastra",
                "Agarra objetos con las manos",
                "Se pone de pie con apoyo"
            ],
            "lenguaje": [
                "Balbucea",
                "Responde a su nombre",
                "Imita sonidos",
                "Dice 'mamá' o 'papá' de forma específica",
                "Utiliza gestos básicos"
            ],
            "descubrimiento_natural_cultural": [
                "Explora objetos con la boca",
                "Sigue objetos con la mirada",
                "Muestra curiosidad por su entorno",
                "Reacciona a sonidos del ambiente",
                "Reconoce sonidos de animales comunes"
            ]
        }
    },
    "12-18": {
        "name": "12 a 18 meses",
        "age_range_label": "12 meses y 16 días a 18 meses y 15 días",
        "milestones": {
            "vinculacion_emocional": [
                "Busca la cercanía de la madre/padre o cuidador.",
                "Sonríe y aplaude cuando logra algo nuevo.",
                "Se tranquiliza con la voz de personas conocidas.",
                "Muestra ansiedad frente a personas extrañas.",
                "Disfruta juegos sencillos con adultos."
            ],
            "expresion_corporal": [
                "Camina con ayuda de un adulto o sosteniéndose de objetos",
                "Gatea con rapidez para alcanzar objetos",
                "Se pone de pie solo, apoyándose en muebles.",
                "Sube y baja de pequeños muebles con ayuda.",
                "Intenta arrastrar o empujar objetos pesados (sillas, cajas)."
            ],
            "lenguaje": [
                "Dice palabras simples como “mamá”, “papá”, “agua”.",
                "Balbucea imitando entonaciones de adultos.",
                "Utiliza gestos para pedir lo que quiere (señalar, estirar la mano).",
                "Imita sonidos de animales.",
                "Responde a su nombre con gestos o sonidos."
            ],
            "descubrimiento_natural_cultural": [
                "Busca un objeto oculto en su presencia.",
                "Reconoce y señala partes del cuerpo.",
                "Observa con atención juguetes de diferentes texturas.",
                "Explora su entorno golpeando y sacudiendo objetos",
                "Reacciona con interés a ruidos fuertes o extraños"
            ]
        }
    },
    "18-24": {
        "name": "18 a 24 meses",
        "age_range_label": "18 meses y 16 días a 24 meses y 15 días",
        "milestones": {
            "vinculacion_emocional": [
                "Se aferra a su cuidador principal en lugares desconocidos.",
                "Expresa celos o enojo cuando no obtiene atención.",
                "Juega de manera paralela al lado de otros niños",
                "Abraza o acaricia a personas cercanas.",
                "Se alegra al reencontrarse con familiares."
            ],
            "expresion_corporal": [
                "Camina solo con seguridad.",
                "Corre aunque tropieza fácilmente.",
                "Intenta subir gradas con apoyo.",
                "Empuja y arrastra juguetes con ruedas.",
                "Intenta comer con cuchara aunque derrame."
            ],
            "lenguaje": [
                "Dice frases de dos palabras (“quiero agua”, “más pan”).",
                "Nombra objetos familiares de su entorno.",
                "Comprende órdenes simples (“ven”, “siéntate”).",
                "Señala imágenes en libros cuando se las nombran.",
                "Reconoce y repite nombres de personas cercanas."
            ],
            "descubrimiento_natural_cultural": [
                "Reconoce sonidos de animales comunes",
                "Imita acciones cotidianas de los adultos (barrer, dar de comer).",
                "Clasifica objetos sencillos (grande/pequeño)",
                "Se interesa en jugar con arena, agua u otros materiales.",
                "Explora rincones de la casa o centro infantil con curiosidad."
            ]
        }
    },
    "24-36": {
        "name": "2 a 3 años",
        "age_range_label": "24 meses y 16 días a 36 meses y 15 días",
        "milestones": {
            "vinculacion_emocional": [
                "Comienza a compartir juguetes, aunque con dificultad.",
                "Participa en juegos grupales simples guiados por adultos",
                "Se muestra más independiente al separarse de los padres.",
                "Se enoja cuando no logra lo que desea.",
                "Dice “gracias” o “por favor” con guía del adulto."
            ],
            "expresion_corporal": [
                "Corre con mayor seguridad.",
                "Patea una pelota colocada en el suelo.",
                "Sube y baja gradas solo, alternando los pies, aunque puede necesitar apoyo en ocasiones.",
                "Salta con ambos pies al mismo tiempo.",
                "Enhebra objetos grandes en un cordón."
            ],
            "lenguaje": [
                "Forma frases de 3 a 4 palabras.",
                "Responde preguntas sencillas (“¿qué es esto?”, “¿dónde está?”).",
                "Canta fragmentos de canciones conocidas.",
                "Utiliza el pronombre “yo” para referirse a sí mismo.",
                "Nombra a varios compañeros o familiares."
            ],
            "descubrimiento_natural_cultural": [
                "Clasifica objetos por color o forma.",
                "Reconoce diferencias entre animales o juguetes.",
                "Imita situaciones de la vida diaria en el juego (cocinar, manejar).",
                "Construye torres con 4 a 6 bloques.",
                "Se interesa en observar insectos, plantas u otros elementos de la naturaleza."
            ]
        }
    },
    "36-42": {
        "name": "36 a 42 meses",
        "age_range_label": "36 meses y 16 días a 42 meses y 15 días",
        "milestones": {
            "vinculacion_emocional": [
                "Coopera con otros en juegos de roles.",
                "Expresa afecto hacia amigos o adultos conocidos.",
                "Pide disculpas cuando se le recuerda.",
                "Demuestra interés por pertenecer a un grupo.",
                "Respeta turnos simples en juegos.",
            ],
            "expresion_corporal": [
                "Salta con ambos pies desde una altura pequeña (hasta 30 cm).",
                "Lanza y atrapa una pelota grande.",
                "Corre y se detiene con mayor control.",
                "Ensarta cuentas de diferentes tamaños en un hilo con mayor precisión.",
                "Se desplaza agachado o gateando en juegos de exploración (túneles, debajo de mesas)",
            ],
            "lenguaje": [
                "Mantiene conversaciones cortas sobre experiencias cotidianas.",
                "Reproduce cuentos sencillos.",
                "Memoriza y canta canciones completas.",
                "Utiliza oraciones de 5 o más palabras.",
                "Dice su nombre completo y su edad cuando se le pregunta.",
            ],
            "descubrimiento_natural_cultural": [
                "Agrupa objetos por tamaño, forma y color.",
                "Reconoce sonidos de animales y fenómenos (trueno, lluvia).",
                "Hace construcciones imitando un modelo.",
                "Diferencia lo que está “dentro/fuera” o “arriba/abajo”.",
                "Pregunta con insistencia “¿por qué?” mostrando curiosidad.",
            ],
        }
    },
    "48-60": {
        "name": "4 a 5 años",
        "age_range_label": "48 meses y 16 días a 60 meses",
        "milestones": {
            "vinculacion_emocional": [
                "Tiene amigos definidos",
                "Resuelve conflictos con palabras",
                "Muestra independencia",
                "Entiende y sigue reglas sociales",
                "Expresa emociones de forma adecuada"
            ],
            "expresion_corporal": [
                "Salta la cuerda",
                "Anda en bicicleta con rueditas",
                "Escribe su nombre",
                "Corta con tijeras siguiendo líneas",
                "Se viste completamente solo"
            ],
            "lenguaje": [
                "Usa gramática correcta",
                "Cuenta historias detalladas con secuencia",
                "Entiende opuestos",
                "Participa en conversaciones complejas",
                "Comprende instrucciones de varios pasos"
            ],
            "descubrimiento_natural_cultural": [
                "Cuenta hasta 20",
                "Reconoce letras y números",
                "Entiende conceptos de cantidad (más, menos, igual)",
                "Hace predicciones simples",
                "Comprende relaciones causa-efecto"
            ]
        }
    }
}


# Domain display names mapping (official IDII names)
DOMAIN_DISPLAY = {
    'vinculacion_emocional': 'Vinculación Emocional y Social',
    'descubrimiento_natural_cultural': 'Descubrimiento del Medio Natural y Cultural',
    'expresion_corporal': 'Exploración del Cuerpo y Motricidad',
    'lenguaje': 'Lenguaje Verbal y No Verbal'
}

# Domain order for consistent rendering
DOMAIN_ORDER = [
    'vinculacion_emocional',
    'expresion_corporal',
    'lenguaje',
    'descubrimiento_natural_cultural'
]


def get_milestones_for_age(age_months):
    """
    Obtener hitos apropiados para la edad del niño.
    Soporta tanto enteros (truncados) como floats (age_months_precise).
    """
    # Precision handling: 16 days = +0.5 months
    age = float(age_months)
    
    if age < 12.5:
        return MILESTONES_CATALOG["0-12"]
    elif age < 18.5:
        return MILESTONES_CATALOG["12-18"]
    elif age < 24.5:
        return MILESTONES_CATALOG["18-24"]
    elif age < 36.5:
        return MILESTONES_CATALOG["24-36"]
    elif age < 42.5:
        return MILESTONES_CATALOG["36-42"]
    else:
        # Fallback for children older than 42 months (standard IDII ends at 36-42)
        return MILESTONES_CATALOG.get("48-60", MILESTONES_CATALOG["36-42"])


def get_all_age_ranges():
    """Obtener todos los rangos de edad disponibles"""
    return [
        {"key": k, "name": v["name"], "label": v.get("age_range_label", v["name"])}
        for k, v in MILESTONES_CATALOG.items()
    ]
