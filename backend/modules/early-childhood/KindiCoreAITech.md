# **KindiCoreAI: Sistema Integral de Gestión y Monitoreo de los Centros de Desarrollo y Cuidado Infantil**

## **1\. Visión General**

KindiCoreAI es una plataforma **Multi-tenant** y **Multi-agente** diseñada para centralizar, automatizar y optimizar la gestión de centros infantiles (CDI/CMCI). El sistema integra la gestión administrativa tradicional con capacidades avanzadas de Inteligencia Artificial para el monitoreo preventivo y la generación de reportes inteligentes.


## **2\. Stack Tecnológico (The Core)**

El sistema se construye bajo una arquitectura robusta, escalable y moderna:

* **Backend:** Python 3.14 (Bleeding Edge) con **Flask**.  
* **Estructura de Backend:** Uso estricto de **Blueprints** para modularidad por cada uno de los 12 módulos clave.  
* **Inteligencia Artificial:**
  * **LangGraph Flow:** Arquitectura "General + Ejército" (Ver `ARCHITECTURE_AGENTS_V2.md`).
  * **LangChain Tools:** `RunSQLAgentTool` para análisis seguro de datos.  
  * **Modelos:** Integración con Gemini 2.0 Flash y OpenAI GPT-4o vía Router unificado.  
* **Frontend:** Next.js 14, TypeScript, Tailwind CSS.  
* **Base de Datos:** Remote MySQL (Relational) + Pinecone (Vectorial).  
* **Integraciones:** WhatsApp (Baileys), Telegram (Bot API), Google Calendar.

## **3\. Arquitectura de Módulos (Blueprints)**

### **M1: Registro, Caracterización y Postulación**

* **Funcionalidad:** Implementa la lógica de las fichas socioeconómicas y de vulnerabilidad.  
* **Interface:** Formularios dinámicos con validación en tiempo real.  
* **IA Tool:** Agente de scoring de vulnerabilidad que prioriza automáticamente basándose en los datos del núcleo familiar y georreferenciación.

### **M2: Gestión de Expedientes Digitales y Fichas**

* **Digitalización:** Carga de documentos con OCR para extraer datos de cédulas y certificados.  
* **Fichas Técnicas:** Réplica digital exacta de:  
  * Ficha de Visita Técnica (Informes, objetivos, percepciones).  
  * Ficha IDII (Indicadores de Desarrollo Infantil Integral).  
  * Ficha Socioeconómica.  
* **Versionamiento:** Historial completo de cambios en cada expediente.

### **M3: Seguimiento Integral y Salud (IDII)**

* **Hitos del Desarrollo:** Registro de indicadores por rangos de edad (12-18 meses, 18-24, etc.).  
* **Alertas Tempranas:** Gráficos de curvas de crecimiento y desarrollo.  
* **IA Monitoring:** El sistema detecta desviaciones en los hitos del desarrollo y genera una alerta automática al psicólogo del centro.

### **M5: Ingestión Masiva y Reportes [NUEVO]**

* **Carga Masiva (CSV):** Motor genérico con validación fila por fila para 7 entidades críticas.
* **Nutrición Avanzada:** Planificación de menú semanal para centros y licencias.
* **Reportes:** Generación de resúmenes operativos y fichas técnicas.

### **M4: Control de Asistencia y Operaciones**

* **Registro:** Interfaz rápida para educadoras.  
* **Cruce de Datos:** Vinculación con el módulo de nutrición para cálculo de raciones diarias.

## **4\. Sistema Multi-Agente (KindiAI Agents)**

Utilizando **LangGraph**, el sistema despliega una jerarquía de agentes:

1. **General (Orquestador):** Interfaz conversacional que mantiene memoria y delega.
2. **Ejército SQL (Data Team):** 
   - **Manager:** Clasifica intención.
   - **Reader:** Genera reportes de solo lectura.
   - **Writer:** Ejecuta cambios bajo estricto control RBAC.
3. **Agente de Ingesta:** Procesa fotos/audios.

## **5\. Perfiles de Usuario y Seguridad**

* **License Admin:** Configuración de Bots (WhatsApp/Telegram), gestión de centros.
* **Coordinador de Centro:** Gestión operativa de su sede.  
* **Educadora:** Registro diario.  
* **Padre/Guardián:** Acceso restringido solo a su hijo (vía Chatbot).

## **6\. Diseño de Interfaz (UI/UX)**

* **Design System:** ShadcnUI + TailwindCSS.
* **Dashboard Principal:** Widgets con indicadores de cobertura, cupos disponibles y alertas críticas.  
* **Canales:** Modal de configuración de mensajería integrado.
* **Mapas de Calor:** Visualización de la georreferenciación de beneficiarios para análisis de zonas de influencia.  
* **Mobile First:** Optimizado para que las educadoras registren datos desde tablets o teléfonos.

## **7\. Estado de Implementación Técnica**

### **Fase 1: Core & DB (Completado ✅)**

* Configuración de Flask con estructura de Blueprints.  
* Modelado de base de datos y migración a MySQL Remoto.  
* Seguridad JWT y RBAC granular implementados.

### **Fase 2: Módulos Operativos (Completado ✅)**

* Desarrollo de formularios de inscripción y postulación.  
* Módulo de asistencia y gestión de expedientes.  
* Backend de Licencias y Tenants.

### **Fase 3: IA & Multi-agente (En Progreso 🚀)**

* Configuración de LangChain y LangGraph.  
* **Orquestador LangGraph:** Implementado.
* **SQL Team Tools:** Implementado.
* **Integración Mensajería:** WhatsApp/Telegram Backend listo.
* **RAG System:** Implementado (Pinecone + ConsultKnowledgeTool).
* **Bulk Ingestion:** Implementado.

### **Fase 4: Reportes y Dashboards (En Progreso 🚀)**

* **Nutrición:** Planificación semanal implementada.
* **Reportes PDF:** Generación básica automatizada (Asistencia, Nutrición).
* **Dashboards:** KPIs en tiempo real por centro y licencia.