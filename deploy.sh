#!/bin/bash
set -e

# ══════════════════════════════════════════════════════════════
# 🏛️ AI GovCoreX OS — Master Production Deployment Script
# Designed for Contabo / Ubuntu VPS with PM2, Nginx & Let's Encrypt SSL
# Dominio: aigovcorex.com | app.aigovcorex.com
# ══════════════════════════════════════════════════════════════

echo "══════════════════════════════════════════════════════════════"
echo "🚀 INICIANDO DESPLIEGUE DE PRODUCCIÓN: AI GOVCOREX OS"
echo "Autonomous Agentic Compliance OS for the Public Sector"
echo "══════════════════════════════════════════════════════════════"

# 0. Asegurar Variables de Entorno y Node.js (NVM)
export PATH=$PATH:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin
export NVM_DIR="$HOME/.nvm"

set +e
if [ -s "$NVM_DIR/nvm.sh" ]; then
    echo "📦 Cargando NVM..."
    . "$NVM_DIR/nvm.sh"
fi

if [ -f "$HOME/.bashrc" ]; then
    source "$HOME/.bashrc"
fi

# Verificar Node activo (preferible Node 18 o 20+)
if [ -n "$(type -t nvm)" ]; then
    echo "🔵 Verificando versión de Node en NVM..."
    nvm use default 2>/dev/null || nvm use 20 2>/dev/null || nvm use 18 2>/dev/null || true
fi
set -e

echo "🟢 Node Version: $(node -v 2>/dev/null || echo 'No encontrado')"
echo "🟢 NPM Version:  $(npm -v 2>/dev/null || echo 'No encontrado')"
echo "🟢 Python:       $(python3 --version 2>/dev/null || echo 'No encontrado')"

# Asegurar PM2 instalado
if ! command -v pm2 &> /dev/null; then
    echo "⚙️ PM2 no detectado. Instalando PM2 globalmente..."
    npm install -g pm2
fi
echo "🟢 PM2 Version:  $(pm2 -v 2>/dev/null || echo 'No encontrado')"

ROOT_DIR="$(pwd)"

# ── 1. Portal Matriz Institucional (Next.js en :3000) ──
echo ""
echo "🏛️ [1/6] Compilando Portal Matriz Institucional (frontend/portal)..."
cd "$ROOT_DIR/frontend/portal"
if [ -d ".next" ]; then
    rm -rf .next
fi
npm install
npm run build
cd "$ROOT_DIR"

# ── 2. Dashboard Operativo de Programas Sociales (Next.js en :9002) ──
echo ""
echo "⚛️ [2/6] Compilando Dashboard Operativo (frontend/dashboard)..."
cd "$ROOT_DIR/frontend/dashboard"
if [ -d ".next" ]; then
    rm -rf .next
fi
npm install
npm run build
cd "$ROOT_DIR"

# ── 3. Backend Python Agéntico (Flask / WSGI en :5000) ──
echo ""
echo "🐍 [3/6] Configurando Backend Python (backend/modules/early-childhood)..."
cd "$ROOT_DIR/backend/modules/early-childhood"
if [ ! -d "venv" ]; then
    echo "📦 Creando entorno virtual Python (venv)..."
    python3 -m venv venv
fi
source venv/bin/activate
pip install --upgrade pip -q
pip install -r requirements.txt -q

# Verificar archivo .env en backend
if [ ! -f ".env" ]; then
    if [ -f "$ROOT_DIR/.env" ]; then
        echo "📋 Copiando .env de la raíz al backend..."
        cp "$ROOT_DIR/.env" .env
    elif [ -f ".env.example" ]; then
        echo "⚠️ Creando .env desde .env.example en backend..."
        cp .env.example .env
    fi
fi
cd "$ROOT_DIR"

# ── 4. Microservicio Ingesta de Voz WhatsApp (TypeScript en :3001) ──
echo ""
echo "💬 [4/6] Preparando Microservicio WhatsApp Voice (services/whatsapp-voice)..."
cd "$ROOT_DIR/services/whatsapp-voice"
if [ ! -f ".env" ]; then
    if [ -f "$ROOT_DIR/.env" ]; then
        echo "📋 Copiando .env de la raíz a whatsapp-voice..."
        cp "$ROOT_DIR/.env" .env
    elif [ -f ".env.example" ]; then
        echo "⚠️ Creando .env desde .env.example en whatsapp-voice..."
        cp .env.example .env
    else
        cat << 'ENV_EOF' > .env
PORT=3001
WHATSAPP_SESSION_NAME=aigovcorex-voice-bot
WHATSAPP_BACKEND_URL=http://localhost:5000/api/whatsapp-webhook
ENV_EOF
    fi
fi
npm install
npm run build
cd "$ROOT_DIR"

# ── 5. Configuración Automática de Nginx & Dominios ──
echo ""
echo "🌐 [5/6] Configurando Nginx Reverse Proxy para aigovcorex.com..."
set +e
if command -v apt-get &> /dev/null; then
    if ! command -v nginx &> /dev/null; then
        echo "⚙️ Instalando Nginx..."
        apt-get update -y && apt-get install -y nginx
    fi
fi

if [ -f "$ROOT_DIR/nginx/aigovcorex.conf" ]; then
    echo "📋 Instalando configuración en /etc/nginx/sites-available/aigovcorex..."
    mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled
    cp "$ROOT_DIR/nginx/aigovcorex.conf" /etc/nginx/sites-available/aigovcorex
    ln -sf /etc/nginx/sites-available/aigovcorex /etc/nginx/sites-enabled/aigovcorex
    rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true

    if nginx -t; then
        echo "✅ Sintaxis de Nginx verificada correctamente."
        systemctl reload nginx 2>/dev/null || systemctl restart nginx 2>/dev/null || service nginx restart 2>/dev/null || true
    else
        echo "⚠️ Advertencia en sintaxis de Nginx. Revisa /etc/nginx/sites-available/aigovcorex"
    fi
fi

# ── 6. Configuración de Certificados SSL con Let's Encrypt (Certbot) ──
echo ""
echo "🔒 [6/6] Verificando Certificado SSL Let's Encrypt para aigovcorex.com..."
DOMAINS="-d aigovcorex.com -d www.aigovcorex.com -d app.aigovcorex.com -d dashboard.aigovcorex.com"

if command -v apt-get &> /dev/null; then
    if ! command -v certbot &> /dev/null; then
        echo "⚙️ Instalando Certbot y plugin Nginx..."
        apt-get update -y && apt-get install -y certbot python3-certbot-nginx || true
    fi
fi

if command -v certbot &> /dev/null; then
    # Verificar si el certificado ya existe
    if [ -d "/etc/letsencrypt/live/aigovcorex.com" ]; then
        echo "✅ Certificado SSL ya instalado para aigovcorex.com. Ejecutando verificación de renovación..."
        certbot renew --quiet --no-self-upgrade || true
        systemctl reload nginx 2>/dev/null || true
    else
        echo "🔐 Solicitando certificado SSL gratuito para aigovcorex.com y subdominios..."
        certbot --nginx $DOMAINS \
            --non-interactive \
            --agree-tos \
            --register-unsafely-without-email \
            --redirect 2>&1 | tee /tmp/certbot_install.log || true

        if [ -d "/etc/letsencrypt/live/aigovcorex.com" ]; then
            echo "✅ ¡Certificado SSL instalado y configurado exitosamente con HTTPS!"
            systemctl reload nginx 2>/dev/null || true
        else
            echo "ℹ️ Certbot no pudo completar el SSL en este momento."
            echo "   Asegúrate de que los registros DNS (tipo A) de aigovcorex.com apunten a la IP del VPS."
            echo "   Luego ejecuta manualmente: certbot --nginx $DOMAINS"
        fi
    fi
fi
set -e

# ── 7. Orquestación y Recarga con PM2 Ecosystem ──
echo ""
echo "🔄 Orquestando servicios con PM2 Ecosystem..."
pm2 reload ecosystem.config.js --update-env 2>/dev/null || pm2 start ecosystem.config.js
pm2 save

echo ""
echo "📊 Estado de los servicios AI GovCoreX:"
pm2 status | grep -E "aigovcorex-|App name|id" || pm2 status

# ── 8. Verificación de Salud (Health Checks) ──
echo ""
echo "🔍 Verificando estado de salud del Backend..."
MAX_RETRIES=5
RETRY_INTERVAL=3
ATTEMPT=0
STATUS_CODE=0

while [ $ATTEMPT -lt $MAX_RETRIES ]; do
    ATTEMPT=$((ATTEMPT + 1))
    sleep $RETRY_INTERVAL
    STATUS_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:5000/health || echo "000")
    if [ "$STATUS_CODE" -eq 200 ]; then
        echo "✅ Backend respondiendo OK en http://localhost:5000/health (Status: $STATUS_CODE)"
        break
    fi
    echo "  ↳ Intento $ATTEMPT/$MAX_RETRIES — Esperando respuesta (HTTP $STATUS_CODE)..."
    if [ $ATTEMPT -eq $MAX_RETRIES ]; then
        echo "⚠️ Advertencia: El backend tardó en responder. Verifica logs con: pm2 logs aigovcorex-backend"
    fi
done

echo ""
echo "══════════════════════════════════════════════════════════════"
echo "✅ ¡DESPLIEGUE DE AI GOVCOREX OS COMPLETADO CON ÉXITO!"
echo "   - 🏛️ Portal Matriz:         https://aigovcorex.com"
echo "   - ⚛️ Dashboard Operativo:    https://app.aigovcorex.com"
echo "   - 🐍 Backend Agéntico:       https://aigovcorex.com/api"
echo "   - 💬 Gateway WhatsApp:       https://aigovcorex.com/whatsapp"
echo "══════════════════════════════════════════════════════════════"
