# WhatsApp Multi-Tenant API

A Node.js/TypeScript microservice built with Express and [Baileys](https://github.com/WhiskeySockets/Baileys) for managing multiple WhatsApp sessions in a multi-tenant environment.

## Features

- **Multi-Tenant Sessions**: Each company/tenant gets its own isolated WhatsApp session
- **QR Code Authentication**: Generate SVG QR codes for WhatsApp Web authentication
- **Message Sending**: Send text messages, images, videos, audio, and documents
- **Incoming Messages**: Event-based message reception (for webhook integration)
- **Session Management**: Start, stop, and monitor session status

## Installation

```bash
npm install
npm run build
npm run dev
```

## API Endpoints

### Session Management

#### Initialize Session
```http
POST /session/init
Content-Type: application/json

{
  "companyId": "company-uuid"
}
```

#### Get QR Code (SVG)
```http
GET /session/qr/:companyId
```
Returns SVG image of QR code. Display this in your frontend for the user to scan.

#### Get Session Status
```http
GET /session/status/:companyId
```
Response:
```json
{
  "companyId": "company-uuid",
  "connected": true,
  "state": "open"
}
```

#### List All Sessions
```http
GET /session/list
```

#### Logout Session
```http
POST /session/logout
Content-Type: application/json

{
  "companyId": "company-uuid"
}
```

### Messaging

#### Send Message
```http
POST /lead
Content-Type: application/json

{
  "companyId": "company-uuid",
  "phone": "1234567890",
  "message": "Hello from OnePunch!"
}
```

## Integration with OnePunch Python Backend

This API is designed to be called from the main OnePunch Flask/Python application:

1. **Company Registration Flow**:
   - When a company registers, call `POST /session/init` with their `company_id`
   - Poll `GET /session/qr/:companyId` and display the SVG in the company's dashboard
   - Monitor `GET /session/status/:companyId` until `connected: true`

2. **Message Sending**:
   - Use `POST /lead` with `companyId`, `phone`, and `message`

3. **Incoming Messages**:
   - The API emits events for incoming messages
   - Future: Configure a webhook URL to forward messages to the Python backend

## Environment Variables

```env
PORT=3001
```

## Docker

```bash
docker build -t whatsapp-api .
docker run -p 3001:3001 -v $(pwd)/tokens:/app/tokens whatsapp-api
```

Note: Mount the `tokens` directory to persist session data across container restarts.

## Session Storage

Session credentials are stored in the `tokens/` directory, organized by `companyId`:
```
tokens/
├── company-1/
│   ├── creds.json
│   └── ...
├── company-2/
│   ├── creds.json
│   └── ...
```

## Architecture

```
src/
├── app.ts                      # Express server entry
├── application/
│   └── lead.create.ts          # Business logic for message handling
├── domain/
│   └── lead-external.repository.ts  # Interface definitions
└── infrastructure/
    ├── controller/
    │   ├── lead.ctrl.ts        # Message endpoints
    │   └── session.ctrl.ts     # Session management endpoints
    ├── repositories/
    │   └── baileys.repository.ts  # Multi-tenant Baileys wrapper
    ├── router/
    │   ├── lead.route.ts
    │   └── session.route.ts
    └── ioc.ts                  # Dependency injection
```

## Known Bugs & Fixes (2026 Update)

### 1. Baileys v7.x "Connection Failure 405" (QR Code Not Showing)
Recent versions of `@whiskeysockets/baileys` (e.g., `7.0.0-rc.9`) suffer from a bug where WhatsApp Web rejects the default connection attempt with an **Error 405 (Not Allowed)** before generating the QR code.
**The Fix (Implemented in `baileys.repository.ts`):**
- Explicitly pass a working WhatsApp Web version to the socket config: `version: [2, 3000, 1033893291]`
- Override the browser config to bypass newer restrictions: `browser: ["KindiCoreAI", "Chrome", "1.0.0"]`
- Added a 3-attempt limit for the 405 error reconnect loop to prevent infinite crashing.

### 2. Missing TypeScript Declarations (Errors TS7016, TS7006)
Baileys updates removed bundled `.d.ts` types, causing implicit `any` errors in `ts-node`.
**The Fix:**
- A custom type declaration file `src/types/baileys.d.ts` is explicitly loaded via `tsconfig.json` (`"files"` array).
- Explicit `: any` annotations were added to parameters in `mysql.auth.ts` and `baileys.repository.ts` to satisfy `strict` compilation rules.