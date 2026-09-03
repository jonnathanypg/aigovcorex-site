# **Manifiesto Técnico y Funcional para la Implementación de un Ecosistema Digital de Gestión Integral en Centros de Desarrollo Infantil (CDI) bajo Arquitectura Multiagente y Multi-tenant**

La gestión de los Centros de Desarrollo Infantil (CDI) en el Ecuador, orientada a la atención de niñas y niños de 1 a 3 años de edad, representa un desafío de alta complejidad que amalgama la responsabilidad pedagógica, la vigilancia nutricional, el control de salud preventiva y la eficiencia administrativa.1 El despliegue de una plataforma tecnológica diseñada específicamente para este sector no solo debe cumplir con la automatización de procesos, sino que debe alinearse rigurosamente con la normativa técnica del Ministerio de Inclusión Económica y Social (MIES), la cual estandariza la prestación de servicios en modalidades públicas, privadas y de convenio.1 Este reporte técnico detalla la arquitectura, los requisitos funcionales y el diseño de un sistema basado en inteligencia artificial multiagente, con capacidad multi-tenant, desarrollado sobre un stack de tecnologías modernas que incluyen Python, Flask, JavaScript y bases de datos MySQL, optimizado para entornos de despliegue en la infraestructura de Hostinger.6

## **Marco Normativo y Requerimientos Operativos de los CDI**

Para comprender la estructura del software, es imperativo analizar el entorno regulatorio de los CDI en Ecuador. La Norma Técnica de Desarrollo Infantil Integral establece que estos centros deben garantizar el desarrollo integral mediante el juego, el aprendizaje y el cuidado diario.1 La plataforma debe digitalizar los procesos definidos en los seis componentes de calidad: participación familiar, proceso socioeducativo, salud y nutrición, talento humano, infraestructura y administración.3

### **Componentes de Atención y Parámetros Técnicos**

El sistema debe permitir el monitoreo nominal de cada infante, asegurando que se cumplan los estándares de alimentación, los cuales dictan que la asistencia alimentaria en el CDI constituye el 70% de las recomendaciones nutricionales diarias, distribuidas en cuatro tiempos de comida.1 La ingesta de datos debe permitir registrar el consumo calórico específico por grupo de edad, diferenciando entre niños de 12 a 24 meses y de 24 a 36 meses.1

| Grupo de Edad | Requerimiento Calórico Diario (70% en CDI) | Distribución de Tiempos |
| :---- | :---- | :---- |
| 12 \- 24 meses | 800 \- 1000 Kcal (aprox.) | Desayuno, Refrigerio AM, Almuerzo, Refrigerio PM |
| 24 \- 36 meses | 1000 \- 1200 Kcal (aprox.) | Desayuno, Refrigerio AM, Almuerzo, Refrigerio PM |
| Lactancia | Variable según meses | Mínimo 3 tomas de leche materna extraída 3 |

Además de la nutrición, el sistema debe gestionar la jornada diaria, que se realiza cinco días a la semana durante 8 horas.1 La interfaz para las educadoras debe facilitar el registro rápido de las actividades de cierre, aseo, descanso y recreación, asegurando que el proceso socioeducativo se documente mediante planificaciones participativas (diarias, semanales y mensuales).1

## **Arquitectura del Sistema: Multi-tenancy y Escalabilidad**

El requisito de una plataforma multi-tenant es fundamental para permitir que diferentes centros infantiles, guarderías y kindergartens operen de forma independiente dentro de la misma infraestructura, garantizando el aislamiento de datos y la personalización de usuarios.8

### **Estrategia de Aislamiento de Datos**

Para el despliegue en Hostinger, se propone una arquitectura de base de datos única con esquemas lógicos separados o discriminación por identificador de inquilino (tenant\_id). Esta opción es técnicamente superior a la creación de múltiples bases de datos físicas, ya que optimiza el uso de recursos del servidor, como los límites de conexiones simultáneas y el uso de CPU, que en planes compartidos o VPS básicos de Hostinger son finitos.14

La implementación en Flask utiliza middleware para interceptar cada solicitud y filtrar los datos basándose en el contexto del centro específico al que pertenece el usuario autenticado.8 La estructura de la cuenta principal por centro permite que cada institución gestione su propia nómina de talento humano, la cual incluye coordinadores, educadoras y personal administrativo.10

| Nivel de Usuario | Atribuciones en el Sistema | Frecuencia de Uso |
| :---- | :---- | :---- |
| Administrador Global | Gestión de centros, monitoreo de facturación SAAS | Baja (Supervisión) |
| Coordinador de Centro | Validación de planificaciones, reportes distritales, talento humano | Alta (Gestión técnica) |
| Educadora | Registro de asistencia, hitos de desarrollo, alimentación | Constante (Operación) |
| Administrativo | Facturación, gestión de costos, inventarios de insumos | Media (Soporte) |

## **Sistema Multiagente e Inteligencia Artificial Conversacional**

La integración de un sistema multiagente permite que los usuarios interactúen con la base de datos MySQL mediante lenguaje natural a través de canales de mensajería como WhatsApp, Telegram y un chat interno embebido en la aplicación.19

### **El Agente Orquestador y el Patrón de Ejecución**

La arquitectura de IA se basa en un "Agente Orquestador" que actúa como el cerebro central. Este componente utiliza un Modelo de Lenguaje de Gran Tamaño (LLM) para interpretar la intención del mensaje del usuario y decidir cuál de los "Agentes Ejecutores" especializados debe invocar.23

1. **Agente de Ingesta:** Transforma mensajes como "Hola, hoy el niño Daniel López consumió todo su almuerzo pero tuvo deposiciones líquidas" en registros estructurados en las tablas de Nutricion\_Diaria y Salud\_Novedades de MySQL.26  
2. **Agente de Asistencia:** Gestiona el control de presencia mediante el procesamiento de listas enviadas por voz o texto, actualizando la asistencia diaria exigida por la cobertura SIIMIES.29  
3. **Agente de Resúmenes:** Genera síntesis instantáneas para coordinadores sobre el estado de un niño o de un centro completo. "Dame un resumen del desarrollo motriz de Sofía este mes".25  
4. **Agente de Contactos:** Recupera rápidamente información de representantes y protocolos de emergencia ante incidentes reportados por las educadoras.22

Esta manipulación del sistema mediante conversaciones democratiza el uso de la tecnología, permitiendo que las educadoras registren hitos de desarrollo sin abandonar sus actividades pedagógicas en el aula, simplemente enviando un mensaje al bot.11

### **Lógica de Procesamiento y Webhooks**

La conexión entre los servicios de mensajería y el backend de Flask se realiza mediante Webhooks.19 Cuando un mensaje llega al bot de WhatsApp (vía Twilio o Meta Cloud API), el sistema valida la identidad del remitente basándose en su número de teléfono, recupera el tenant\_id asociado y envía el contenido al orquestador.33 El orquestador mantiene el historial de la conversación utilizando técnicas de manejo de contexto para asegurar que las referencias a "él" o "ella" se vinculen correctamente al niño mencionado previamente.19

La transformación de lenguaje natural a datos estructurados se rige por la siguiente lógica matemática de validación de confianza:

$$Confianza\_{total} \= \\alpha(Score\_{LLM}) \+ \\beta(Score\_{Trustworthiness})$$  
Donde el sistema solo ejecuta la transacción en la base de datos si la confianza supera un umbral definido, evitando alucinaciones o registros erróneos en el expediente del menor.37

## **Interfaz de Usuario, Analíticas y Dashboard**

La interfaz web es el componente central para la revisión y el análisis profundo de los datos. Desarrollada con HTML, CSS y JavaScript, utiliza AJAX para garantizar una experiencia de usuario fluida sin recargas de página innecesarias, lo cual es crítico en entornos de conectividad intermitente.34

### **Visualización y Analítica de Datos**

El módulo de analítica debe proporcionar gráficos dinámicos que permitan a los coordinadores y equipos administrativos visualizar indicadores clave de desempeño (KPIs) exigidos por la normativa técnica.1

* **Curvas de Crecimiento:** Visualización de peso y talla comparada con los estándares de la OMS, calculando automáticamente el puntaje Z para detectar desnutrición crónica o sobrepeso.1  
* **Mapas de Calor de Asistencia:** Identificación de patrones de deserción o enfermedades prevalentes en grupos específicos.18  
* **Progresión de Hitos:** Gráficos radiales que muestran el nivel de desarrollo en los cuatro ámbitos: vinculación emocional, descubrimiento natural/cultural, expresión corporal y lenguaje.1

### **Ingesta Manual y Revisión**

A pesar de la potencia del sistema multiagente, la interfaz administrativa permite la ingesta manual detallada y la revisión de los datos capturados por la IA. El flujo de validación asegura que cualquier dato ingresado mediante el bot deba ser ratificado por la coordinadora al final del día antes de ser consolidado en los reportes oficiales.8

## **Generación Automática de Reportes y Exportación**

El sistema de reportes es el pilar de la rendición de cuentas. El software debe automatizar la creación de informes diarios y permitir la exportación de datos históricos por períodos específicos.

### **Reportes Diarios Automatizados**

Utilizando Flask-APScheduler, el sistema programa una tarea diaria que se ejecuta a una hora preestablecida (ej. 17:30 H) para consolidar el resumen de asistencia, actividades pedagógicas y novedades de salud.40 Este reporte se envía vía correo electrónico a los representantes y a la administración central, utilizando plantillas HTML personalizadas que reflejan la identidad visual de cada centro.46

| Tipo de Reporte | Frecuencia | Destinatario | Formato de Envío |
| :---- | :---- | :---- | :---- |
| Resumen de Actividad Diaria | Diaria | Padres / Representantes | Email (HTML) |
| Informe de Asistencia Mensual | Mensual | Administración / MIES | PDF / Excel |
| Ficha de Vulnerabilidad R01 | Al ingreso | Coordinación Distrital | PDF 2 |
| Control de Insumos y Costos | Semanal | Equipo Administrativo | CSV / Google Sheets |

### **Capacidades de Exportación Multiformato**

El sistema integra librerías de Python especializadas para transformar los datos de MySQL en documentos profesionales:

1. **PDF (ReportLab / PDFKit):** Generación de fichas oficiales con logotipos, bordes y formatos estandarizados por el ente rector, incluyendo firmas electrónicas para validez legal.47  
2. **CSV / Excel (Pandas / Flask-Excel):** Exportación de grandes volúmenes de datos para análisis externo o carga en sistemas gubernamentales como el SIIMIES.30  
3. **Google Sheets (gspread):** Sincronización bidireccional que permite a los administrativos manipular datos en la nube sin salir del entorno de Google Workspace, facilitando la creación de tableros colaborativos.51

La exportación por períodos específicos se gestiona mediante consultas SQL parametrizadas que filtran por rango de fechas y tenant\_id, asegurando que el usuario solo descargue la información que le compete.16

## **Manifiesto Técnico: Stack Tecnológico y Despliegue**

La construcción del sistema se basa en un stack de tecnologías seleccionadas por su robustez, facilidad de integración y compatibilidad con los servicios de hosting de Hostinger.6

### **Backend y Lógica de Negocio**

El uso de **Python** y **Flask** permite desarrollar una API RESTful eficiente que maneja tanto las solicitudes de la interfaz web como las de los bots de mensajería.19 Flask, al ser un micro-framework, proporciona la flexibilidad necesaria para integrar el orquestador de agentes sin imponer una estructura rígida, lo cual es ideal para sistemas que evolucionan rápidamente.44

### **Base de Datos y Persistencia**

Se utiliza **MySQL** como motor de base de datos relacional. En el contexto de Hostinger, es fundamental optimizar las consultas para no exceder el max\_statement\_time y gestionar correctamente el pool de conexiones para no superar el límite de max\_user\_connections.14 La configuración de la base de datos debe contemplar el soporte para caracteres UTF-8 para manejar correctamente los nombres y descripciones en español.7

### **Frontend y Comunicación Asíncrona**

La interfaz de usuario se construye con:

* **HTML5 y CSS3:** Para un diseño responsivo que se adapte a tablets y móviles usados por las educadoras en campo.35  
* **JavaScript y AJAX:** Para la comunicación en tiempo real con el backend, permitiendo que las actualizaciones de los bots se reflejen instantáneamente en el dashboard del coordinador sin refrescar la página.34

### **Despliegue en Hostinger**

Para garantizar que el sistema multiagente y el programador de tareas funcionen ininterrumpidamente, el despliegue debe realizarse en un **VPS (Servidor Privado Virtual)** de Hostinger.6 El hosting compartido tradicional no soporta procesos persistentes de Python de larga duración, lo cual es un requisito para mantener los Webhooks y el orquestador activos.6 El VPS permite configurar el entorno de ejecución (Virtualenv), gestionar las dependencias mediante pip y configurar un servidor WSGI como Gunicorn o uWSGI detrás de un servidor proxy inverso como Nginx.6

## **Gestión Operativa: Roles, Seguridad y Auditoría**

La seguridad de la información es un componente crítico, dado que el sistema maneja datos personales de menores y sus familias bajo el marco del Código de la Niñez y Adolescencia.2

### **Control de Acceso y Multi-tenancy**

Cada petición al sistema es validada mediante tokens de seguridad. La arquitectura multi-tenant asegura que las llaves de API de los bots de un centro no puedan acceder a la información de otro.8 Los roles de usuario definen qué módulos son visibles: las educadoras solo acceden a sus grupos asignados, mientras que los coordinadores tienen visión total del centro.10

### **Integridad y Auditoría**

El sistema mantiene un log detallado de auditoría que registra quién, cuándo y desde qué canal (Web, WhatsApp o Telegram) se realizó una modificación. Esto es esencial para el cumplimiento de los estándares de administración y protección de derechos, permitiendo reconstruir la historia clínica o pedagógica de un niño ante cualquier requerimiento legal.1

## **Procesos de Registro y Seguimiento Nominal**

El flujo de trabajo digitalizado sigue el ciclo de atención del CDI desde el ingreso hasta el egreso del infante.2

1. **Admisión:** El administrativo registra la solicitud de ingreso, carga los documentos escaneados (cédulas, partidas de nacimiento) y el sistema verifica la disponibilidad de cobertura.2  
2. **Evaluación Inicial:** Se aplica la ficha de vulnerabilidad y se asigna un puntaje. Si el centro está lleno, el niño entra automáticamente en la lista de espera gestionada por el orquestador.2  
3. **Control Diario:** Las educadoras registran la llegada y salida. El bot de WhatsApp alerta a la coordinadora si un niño no llega a la hora prevista, permitiendo una reacción inmediata.10  
4. **Seguimiento de Salud:** El sistema genera alertas de vacunas pendientes y registra los resultados de las brigadas médicas. La inteligencia artificial analiza los reportes médicos cualitativos para extraer síntomas recurrentes en el centro.28  
5. **Desarrollo Integral:** Mensualmente, el sistema consolida los hitos de aprendizaje alcanzados, generando el informe de progreso que se entrega a la familia.1

## **Conclusiones Técnicas y Operativas**

La implementación de este ecosistema digital representa una transformación profunda en la gestión de los centros infantiles. Al centralizar la operación en una plataforma multi-tenant robusta y dotarla de una capa de inteligencia artificial multiagente, se logra un equilibrio entre el rigor administrativo y la facilidad de uso para el personal operativo.13 La elección del stack tecnológico (Python/Flask/MySQL) y el despliegue optimizado en Hostinger aseguran una solución costo-efectiva y escalable que puede adaptarse no solo a los CDI del MIES, sino a cualquier institución de cuidado infantil que busque excelencia en su servicio.6

La capacidad del sistema para "entender" a las educadoras a través de mensajes de voz o texto y transformar esa información en reportes de calidad, analíticas visuales y exportaciones automatizadas en PDF o Google Sheets, posiciona a esta plataforma como una herramienta indispensable para garantizar el derecho al desarrollo integral de la niñez en el Ecuador.1 La digitalización total de los procesos, desde la ingesta de datos hasta el envío de reportes diarios, asegura una trazabilidad impecable y una comunicación transparente con las familias, cumpliendo con el espíritu de corresponsabilidad que rige la educación inicial moderna.41
