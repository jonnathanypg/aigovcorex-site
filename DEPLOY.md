# 🚀 Guía de Despliegue en Producción — AI GovCoreX OS (Contabo Ubuntu VPS)

Esta guía detalla la arquitectura, el flujo de integración continua (CI/CD con GitHub Actions), la orquestación de procesos con PM2, y las variables requeridas en GitHub Secrets para el despliegue automatizado de **AI GovCoreX OS** en servidores Ubuntu (Contabo VPS).

---

## 🏛️ 1. Arquitectura de Servicios y Puertos

| Servicio | Tecnología | Directorio | Puerto Interno | Dominio / Endpoint |
| :--- | :--- | :--- | :--- | :--- |
| **Portal Matriz Institucional** | Next.js (Node 18/20+) | `frontend/portal` | `3000` | `https://aigovcorex.com` |
| **Dashboard Operativo** | Next.js (TypeScript) | `frontend/dashboard` | `9002` | `https://app.aigovcorex.com` |
| **Backend Agéntico & Compliance** | Python (Flask / WSGI / LangGraph) | `backend/modules/early-childhood` | `5000` | `/api` en ambos dominios |
| **Microservicio WhatsApp Voice** | Node.js (TypeScript / Baileys) | `services/whatsapp-voice` | `3001` | `/whatsapp` |

---

## 🔐 2. Secretos en GitHub Actions (`Settings` -> `Secrets and variables` -> `Actions`)

El workflow está configurado para activarse automáticamente con `git push origin main` y acepta cualquiera de estas nomenclaturas de secretos:

| Nombre del Secreto (Recomendado) | Alternativas Compatibles | Descripción | Ejemplo / Valor |
| :--- | :--- | :--- | :--- |
| `SERVER_HOST` | `MAIN_SERVER_HOST` / `CONTABO_HOST` | Dirección IP pública de tu VPS | `194.163.xxx.xxx` |
| `SERVER_PASSWORD` | `MAIN_SERVER_PASSWORD` / `CONTABO_PASSWORD` | Contraseña SSH de tu servidor VPS | `TuContraseñaSegura123!` |
| `SERVER_USER` | `MAIN_SERVER_USER` / `CONTABO_USER` | Usuario SSH (`root` por defecto si no se define) | `root` |
| `SERVER_PORT` | `MAIN_SERVER_PORT` / `CONTABO_PORT` | Puerto SSH (`22` por defecto si no se define) | `22` |

> 💡 *Si usas una rama `dev` para staging, también puedes definir `DEV_SERVER_HOST` y `DEV_SERVER_PASSWORD` (de forma opcional, si no están configurados usará `CONTABO_HOST`).*

---

## 🖥️ 3. Preparación Inicial del VPS Contabo (Una Sola Vez)

Conéctate a tu servidor Contabo vía SSH:
```bash
ssh root@<TU_IP_CONTABO>
```

### 3.1. Instalar Dependencias del Sistema
```bash
apt update && apt upgrade -y
apt install -y git curl wget build-essential python3 python3-venv python3-pip nginx certbot python3-certbot-nginx
```

### 3.2. Instalar Node.js y PM2
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
nvm alias default 20

# Instalar PM2 globalmente
npm install -g pm2
pm2 startup
```

### 3.3. Crear el Directorio del Proyecto y Configurar el Archivo `.env`
```bash
mkdir -p ~/aigovcorex
cd ~/aigovcorex
```
Crea o copia el archivo `.env` en `~/aigovcorex/.env`:
```bash
nano .env
```
*(Copia el contenido base de `.env.example` y asigna tus credenciales de base de datos MySQL, API Keys de OpenAI/Groq/Pinecone, etc.)*

---

## ⚙️ 4. Configurar Nginx Reverse Proxy y Certificados SSL

Copia la configuración incluida en `nginx/aigovcorex.conf` a Nginx:

```bash
cp ~/aigovcorex/nginx/aigovcorex.conf /etc/nginx/sites-available/aigovcorex
ln -s /etc/nginx/sites-available/aigovcorex /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

Obtener certificados SSL gratuitos con Let's Encrypt:
```bash
certbot --nginx -d aigovcorex.com -d www.aigovcorex.com -d app.aigovcorex.com
```

---

## 🔄 5. Comandos de Gestión y Monitoreo con PM2

Una vez desplegado:

```bash
# Ver estado de todos los servicios
pm2 status

# Ver logs en tiempo real
pm2 logs

# Ver logs de un servicio específico
pm2 logs aigovcorex-backend
pm2 logs aigovcorex-portal
pm2 logs aigovcorex-dashboard
pm2 logs aigovcorex-whatsapp

# Reiniciar todos los servicios
pm2 restart ecosystem.config.js

# Guardar estado de PM2 para autoarranque
pm2 save
```
