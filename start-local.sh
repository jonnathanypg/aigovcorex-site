#!/bin/bash

echo "======================================================================"
echo "🚀 INICIANDO AI GOVCOREX OS — ENTORNO LOCAL"
echo "Autonomous Agentic Compliance OS for the Public Sector"
echo "======================================================================"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 1. Iniciar Backend Python (KindiCore / Early Childhood)
echo "🐍 [1/4] Iniciando Backend Python (Módulo Primera Infancia) en :5000..."
cd "$ROOT_DIR/backend/modules/early-childhood"
if [ -f "venv/bin/activate" ]; then
    source venv/bin/activate
elif [ -f "/Users/macbook/Desktop/AI_LAB-WLT/kindicoreai/kindicore-py/venv/bin/activate" ]; then
    source "/Users/macbook/Desktop/AI_LAB-WLT/kindicoreai/kindicore-py/venv/bin/activate"
fi
python3 app.py &
BACKEND_PID=$!

# 2. Iniciar Servicio WhatsApp Voice
echo "💬 [2/4] Iniciando Servicio WhatsApp Voice en :3001..."
cd "$ROOT_DIR/services/whatsapp-voice"
npx ts-node src/app.ts &
WHATSAPP_PID=$!

# 3. Iniciar Dashboard Frontend (TypeScript)
echo "⚛️ [3/4] Iniciando Dashboard Operativo (Early Childhood) en :9002..."
cd "$ROOT_DIR/frontend/dashboard"
PORT=9002 npm run dev &
DASHBOARD_PID=$!

# 4. Iniciar Portal Matriz (AI GovCoreX)
echo "🏛️ [4/4] Iniciando Portal Matriz AI GovCoreX en :3000..."
cd "$ROOT_DIR/frontend/portal"
PORT=3000 npm run dev &
PORTAL_PID=$!

echo ""
echo "✅ Todos los servicios del AI GovCoreX OS están iniciando:"
echo "   - 🏛️ Portal Matriz:         http://localhost:3000"
echo "   - ⚛️ Dashboard Operativo:    http://localhost:9002"
echo "   - 🐍 Backend Agéntico:       http://localhost:5000"
echo "   - 💬 Gateway WhatsApp:       http://localhost:3001"
echo ""
echo "Presiona CTRL+C para detener todos los servicios."

trap "kill $BACKEND_PID $WHATSAPP_PID $DASHBOARD_PID $PORTAL_PID 2>/dev/null; exit" SIGINT SIGTERM
wait
