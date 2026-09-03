# API Documentation - KindiCore AI

## Base URL
```
http://localhost:5000/api
```

## Authentication

All API endpoints (except `/auth/login`) require JWT authentication.

### Headers
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

---

## Authentication Endpoints

### POST /auth/login
Login to get access token.

**Request:**
```json
{
  "email": "admin@cdi.ec",
  "password": "admin123"
}
```

**Response:**
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "user": {
    "id": 1,
    "email": "admin@cdi.ec",
    "full_name": "Admin Sistema",
    "role": "admin_global"
  }
}
```

### POST /auth/refresh
Refresh access token.

**Headers:** `Authorization: Bearer <refresh_token>`

**Response:**
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}
```

### GET /auth/me
Get current user information.

**Response:**
```json
{
  "user": {
    "id": 1,
    "email": "admin@cdi.ec",
    "full_name": "Admin Sistema",
    "role": "admin_global",
    "tenant_id": 1
  }
}
```

---

## Children Endpoints

### GET /children
Get all children for current tenant.

**Query Parameters:**
- `status` (optional): Filter by status (activo, inactivo, egresado)
- `search` (optional): Search by name

**Response:**
```json
{
  "children": [
    {
      "id": 1,
      "full_name": "María García",
      "age_display": "2 años, 3 meses",
      "status": "activo",
      "assigned_group": "Grupo A"
    }
  ],
  "total": 1
}
```

### GET /children/:id
Get specific child details.

**Response:**
```json
{
  "child": {
    "id": 1,
    "full_name": "María García",
    "birth_date": "2021-10-15",
    "age_months": 27,
    "gender": "femenino",
    "allergies": "Lactosa",
    "medical_conditions": null
  }
}
```

### POST /children
Create new child (requires `manage_center` permission).

**Request:**
```json
{
  "first_name": "Juan",
  "last_name": "Pérez",
  "birth_date": "2022-03-20",
  "gender": "masculino",
  "enrollment_date": "2024-01-10",
  "blood_type": "O+",
  "allergies": "Ninguna"
}
```

### PUT /children/:id
Update child information (requires `manage_center` permission).

---

## Attendance Endpoints

### GET /attendance
Get attendance records.

**Query Parameters:**
- `date` (required): Date in YYYY-MM-DD format

**Response:**
```json
{
  "attendance": [
    {
      "id": 1,
      "child_name": "María García",
      "date": "2024-01-10",
      "status": "presente",
      "arrival_time": "08:30:00"
    }
  ]
}
```

### POST /attendance
Mark attendance.

**Request:**
```json
{
  "child_id": 1,
  "date": "2024-01-10",
  "status": "presente",
  "arrival_time": "08:30"
}
```

---

## Nutrition Endpoints

### GET /nutrition
Get nutrition records.

**Query Parameters:**
- `child_id` (optional): Filter by child
- `date` (optional): Filter by date

**Response:**
```json
{
  "nutrition": [
    {
      "id": 1,
      "child_name": "María García",
      "meal_type": "almuerzo",
      "consumption_level": "todo",
      "consumption_percentage": 100,
      "notes": "Comió todo sin problemas"
    }
  ]
}
```

### POST /nutrition
Log nutrition.

**Request:**
```json
{
  "child_id": 1,
  "meal_type": "almuerzo",
  "consumption_level": "todo",
  "notes": "Comió todo sin problemas"
}
```

**Meal Types:**
- `desayuno`
- `refrigerio_am`
- `almuerzo`
- `refrigerio_pm`
- `lactancia`

**Consumption Levels:**
- `todo` (100%)
- `la_mayoria` (75%)
- `la_mitad` (50%)
- `poco` (25%)
- `nada` (0%)

---

## Health Endpoints

### GET /health
Get health records.

**Query Parameters:**
- `child_id` (optional): Filter by child

**Response:**
```json
{
  "health": [
    {
      "id": 1,
      "child_name": "María García",
      "record_type": "crecimiento",
      "record_date": "2024-01-10",
      "weight": 12.5,
      "height": 85.0
    }
  ]
}
```

### POST /health
Log health record.

**Request:**
```json
{
  "child_id": 1,
  "record_type": "crecimiento",
  "weight": 12.5,
  "height": 85.0,
  "notes": "Crecimiento normal"
}
```

**Record Types:**
- `crecimiento`
- `vacunacion`
- `incidente`
- `enfermedad`
- `brigada_medica`

---

## Milestones Endpoints

### GET /milestones
Get development milestones.

**Query Parameters:**
- `child_id` (optional): Filter by child

**Response:**
```json
{
  "milestones": [
    {
      "id": 1,
      "child_name": "María García",
      "domain": "lenguaje",
      "milestone_description": "Dice palabras simples",
      "achievement_level": "adquirido",
      "record_date": "2024-01-10"
    }
  ]
}
```

### POST /milestones
Record milestone.

**Request:**
```json
{
  "child_id": 1,
  "domain": "lenguaje",
  "milestone_description": "Dice palabras simples",
  "achievement_level": "adquirido"
}
```

**Domains:**
- `vinculacion_emocional`
- `descubrimiento_natural_cultural`
- `expresion_corporal`
- `lenguaje`

**Achievement Levels:**
- `no_iniciado`
- `en_proceso`
- `adquirido`
- `consolidado`

---

## Chat Endpoints

### POST /chat/message
Send message to AI agent system.

**Request:**
```json
{
  "message": "Hoy María comió todo su almuerzo",
  "channel": "web_chat"
}
```

**Response:**
```json
{
  "response": "✅ Registrado para María García:\n- nutrición",
  "success": true,
  "agent_used": "ingesta",
  "confidence": 0.95
}
```

### GET /chat/history
Get conversation history.

**Response:**
```json
{
  "history": [
    {
      "message_text": "Hoy María comió todo",
      "agent_response": "✅ Registrado...",
      "created_at": "2024-01-10T10:30:00"
    }
  ]
}
```

---

## Users Endpoints

### GET /users
Get all users for tenant (requires `manage_center` permission).

**Response:**
```json
{
  "users": [
    {
      "id": 1,
      "full_name": "Admin Sistema",
      "email": "admin@cdi.ec",
      "role": "admin_global",
      "is_active": true
    }
  ]
}
```

### POST /users
Create new user (requires `manage_center` permission).

**Request:**
```json
{
  "email": "educadora@cdi.ec",
  "password": "password123",
  "first_name": "Ana",
  "last_name": "López",
  "role_id": 3,
  "phone": "0999999999"
}
```

---

## Ingestion Endpoints [NUEVO]

### GET /ingestion/entities
Get allowed entities for bulk upload based on user role.

**Response:**
```json
{
  "entities": [
    { "key": "ninos", "label": "Niños" },
    { "key": "asistencia", "label": "Asistencia" }
  ]
}
```

### GET /ingestion/template/:entity
Download CSV template with multi-row examples.

### POST /ingestion/upload/:entity
Upload CSV for processing. Returns status per row.

**Request:** `multipart/form-data` (file)

---

## Nutrition Menu Endpoints [NUEVO]

### GET /nutrition/menu
Get weekly menu planning.

**Query Parameters:**
- `week_start` (required): ISO date of Monday.
- `tenant_id` (optional): Filter by center.

### POST /nutrition/menu
Create or update menu entries.

### DELETE /nutrition/menu/:id
Delete a menu entry.

---

## Error Responses

### 400 Bad Request
```json
{
  "error": "Email y contraseña requeridos"
}
```

### 401 Unauthorized
```json
{
  "error": "Usuario no autenticado"
}
```

### 403 Forbidden
```json
{
  "error": "Permiso denegado"
}
```

### 404 Not Found
```json
{
  "error": "Recurso no encontrado"
}
```

### 500 Internal Server Error
```json
{
  "error": "Error interno del servidor"
}
```

---

## Rate Limiting

Currently no rate limiting is implemented. This should be added in production.

## Pagination

Currently no pagination is implemented. All endpoints return full result sets. This should be added for production use.
