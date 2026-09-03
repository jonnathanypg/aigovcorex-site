# 🎓 KindiCore AI - Sistema de Gestión para Centros de Desarrollo Infantil (CDI)

Sistema integral de gestión para Centros de Desarrollo Infantil en Ecuador, con arquitectura multi-tenant y sistema multi-agente basado en **LangGraph**.

## 🌟 Características Principales

### 🏢 Multi-Tenant
- Soporte para múltiples centros infantiles en una sola instalación
- Aislamiento completo de datos por tenant
- Configuración personalizada por centro

### 🤖 Sistema Multi-Agente con LangGraph
- **Arquitectura basada en StateGraph** para orquestación inteligente
- **6 Herramientas LangChain especializadas:**
  - `SearchChildTool` - Búsqueda inteligente de niños
  - `RecordAttendanceTool` - Registro de asistencia
  - `LogNutritionTool` - Registro de nutrición
  - `LogHealthTool` - Registro de salud
  - `GetChildSummaryTool` - Resúmenes comprehensivos
  - `ConsultKnowledgeTool` - Consulta de base de conocimiento (RAG)
- **Clasificación automática de intenciones**
- **Ejecución de herramientas con validación Pydantic**
- **Generación de respuestas contextuales**

### 📊 Gestión Integral
- **Niños**: Registro completo con información médica, familiar y académica
- **Asistencia**: Control diario con múltiples estados
- **Nutrición**: Seguimiento de consumo alimenticio (70% de requerimientos diarios)
- **Salud**: Monitoreo de crecimiento, vacunas e incidentes
- **Desarrollo**: Seguimiento de hitos en 4 dominios (MIES)
- **Carga Masiva**: Importación/Exportación de datos mediante archivos CSV para 7 entidades
- **Planificación**: Menú nutricional semanal diferenciado por tiempos de comida

### 💬 Canales de Comunicación
- WhatsApp (vía Twilio) - *Placeholder*
- Telegram - *Placeholder*
- Chat web integrado con LangGraph

### 📈 Reportes y Analíticas
- Reportes diarios automatizados
- Exportación a PDF, Excel y Google Sheets
- Curvas de crecimiento OMS
- Mapas de calor de asistencia

---

## 🛠️ Stack Tecnológico

### Backend
- **Python 3.14**
- **Flask** - Framework web
- **SQLAlchemy** - ORM
- **MySQL 8.0+** - Base de datos
- **Flask-JWT-Extended** - Autenticación
- **LangChain** - Framework para LLM
- **LangGraph** - Orquestación multi-agente
- **OpenAI / Google Gemini** - LLM providers
- **Pinecone** - Base de datos vectorial para RAG

### Frontend
El frontend es una aplicación separada desarrollada con **Next.js 14** y se encuentra en el directorio `kindicore-ts`.

### Integraciones
- **WhatsApp:** Microservicio custom en Node.js con `@whiskeysockets/baileys`.
- **Telegram Bot API**
- **Google Sheets API**
- **ReportLab** - Generación de PDFs

---

## 🚀 Instalación

Para obtener una guía de instalación completa y actualizada, por favor, consulta el archivo `README.md` principal en el directorio raíz del proyecto y el script `deploy.sh`.

---

## 🎯 Uso del Sistema

### Interfaz Web
1. Acceder a `http://localhost:5000`
2. Iniciar sesión con credenciales
3. Navegar por el dashboard

### Chat con IA (LangGraph)

El sistema usa **LangGraph** para procesar mensajes en lenguaje natural:

#### Ejemplos de Uso:

**Registrar Nutrición:**
```
"Hoy María comió todo su almuerzo"
→ LangGraph ejecuta LogNutritionTool automáticamente
```

**Registrar Asistencia:**
```
"Asistieron: Juan, Pedro, Sofía. Faltó Daniel"
→ LangGraph ejecuta RecordAttendanceTool para cada niño
```

**Obtener Resúmenes:**
```
"Dame un resumen del desarrollo de Sofía este mes"
→ LangGraph ejecuta GetChildSummaryTool
```

**Buscar Información:**
```
"Necesito el contacto de emergencia de María"
→ LangGraph busca y muestra información de contacto
```

#### Flujo de LangGraph:

```
Usuario → Clasificador de Intenciones
           ↓
    ¿Necesita herramientas?
           ↓
    Sí → Ejecutor de Herramientas → Generador de Respuesta
    No → Generador de Respuesta Directa
```

---

## 🏗️ Estructura del Proyecto

```
kindicore-py/
├── agents/
│   ├── langgraph_orchestrator.py
│   ├── sql_team/
│   └── tools/
├── api/
│   ├── applications.py
│   ├── children.py
│   ├── dashboard.py
│   ├── educator.py
│   ├── ingestion.py
│   ├── notifications.py
│   ├── operations.py
│   ├── reports.py
│   └── ... (otros endpoints)
├── auth/
├── models/
├── services/
│   ├── ingestion_service.py
│   └── ...
├── static/
├── templates/
├── utils/
├── app.py
└── requirements.txt
```

---

## 🔒 Seguridad

- Autenticación JWT
- Passwords hasheados con bcrypt
- Aislamiento de datos por tenant
- Validación de entrada con Pydantic
- Logs de auditoría
- CORS configurado

---

## 📊 Base de Datos

### Tablas Principales:
- `tenants` - Centros CDI
- `users` - Usuarios del sistema
- `children` - Niños registrados
- `families` - Familias
- `attendance` - Asistencia diaria
- `nutrition_daily` - Nutrición
- `menus` - Planificación semanal de alimentación
- `health_records` - Salud
- `milestones` - Hitos de desarrollo
- `conversation_history` - Historial de IA

---

## 🚀 Despliegue en Producción

### Hostinger VPS

1. **Configurar servidor**:
```bash
sudo apt update
sudo apt install python3-pip python3-venv nginx mysql-server
```

2. **Clonar y configurar**:
```bash
git clone <repo>
cd KindiCoreAI
./setup.sh
```

3. **Configurar Gunicorn**:
```bash
gunicorn --bind 0.0.0.0:8000 wsgi:app
```

4. **Configurar Nginx** (ver `deploy/nginx.conf`)

5. **Configurar Systemd** (ver `deploy/systemd/cdi-app.service`)

---

## 📖 Documentación Adicional

- [API Documentation](docs/API.md) - Endpoints completos
- [User Guide](docs/USER_GUIDE.md) - Guía de usuario
- [Validation Report](VALIDATION.md) - Reporte de validación completo
- [Walkthrough](walkthrough.md) - Walkthrough técnico

---

## 🧪 Testing

### Validar Instalación
```bash
source venv/bin/activate
python test_install.py
```

### Ejecutar Tests (cuando estén implementados)
```bash
pytest
```

---

## 🎯 Roadmap

- [x] Sistema multi-agente con LangGraph
- [x] Herramientas LangChain especializadas
- [x] API RESTful completa
- [x] Frontend responsivo
- [x] Integración con WhatsApp/Telegram
- [x] Sistema de notificaciones push
- [ ] Integración con SIIMIES
- [ ] App móvil nativa
- [ ] Reconocimiento de voz avanzado
- [ ] Dashboard de analíticas avanzadas

---

## 📝 Licencia

Propietario - Todos los derechos reservados

---

## 📞 Soporte

Para soporte técnico, contactar al administrador del sistema.

---

## 🏆 Características Técnicas Destacadas

### LangGraph Multi-Agent System
- ✅ **StateGraph** para flujo de conversación
- ✅ **Tool Executor** con validación Pydantic
- ✅ **Clasificación automática** de intenciones
- ✅ **Ejecución paralela** de herramientas
- ✅ **Contexto persistente** en base de datos

### Arquitectura
- ✅ **Multi-tenant** con aislamiento de datos
- ✅ **JWT** para autenticación stateless
- ✅ **RBAC** para autorización granular
- ✅ **Factory Pattern** para Flask app
- ✅ **Blueprint** para modularidad

### Frontend
- ✅ **Vanilla JavaScript** (sin frameworks pesados)
- ✅ **CSS Variables** para theming
- ✅ **Responsive Design** mobile-first
- ✅ **Chat Widget** integrado con LangGraph

---

**Desarrollado con ❤️ para los Centros de Desarrollo Infantil del Ecuador**

**Powered by LangGraph 🦜🔗**
