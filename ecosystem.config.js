// ══════════════════════════════════════════════════════════════
//  🏛️ AI GovCoreX OS — PM2 Production Ecosystem Configuration
//  Orquesta Portal, Dashboard Operativo, Backend Python y WhatsApp Voice
//  Uso: pm2 start ecosystem.config.js
// ══════════════════════════════════════════════════════════════

module.exports = {
  apps: [
    // ── 1. Portal Matriz Institucional (Next.js) ──
    {
      name: "aigovcorex-portal",
      cwd: "./frontend/portal",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production",
        PORT: 3000
      }
    },

    // ── 2. Dashboard Operativo Primera Infancia (Next.js) ──
    {
      name: "aigovcorex-dashboard",
      cwd: "./frontend/dashboard",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 9002",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "600M",
      env: {
        NODE_ENV: "production",
        PORT: 9002
      }
    },

    // ── 3. Backend Python Agéntico & Compliance (Flask / WSGI) ──
    {
      name: "aigovcorex-backend",
      cwd: "./backend/modules/early-childhood",
      script: "./venv/bin/gunicorn",
      args: "wsgi:app --bind 0.0.0.0:5000 --workers 2 --timeout 120",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "600M",
      exp_backoff_restart_delay: 100,
      env: {
        FLASK_ENV: "production",
        PORT: 5000
      }
    },

    // ── 4. Microservicio Ingesta de Voz WhatsApp (TypeScript / Baileys) ──
    {
      name: "aigovcorex-whatsapp",
      cwd: "./services/whatsapp-voice",
      script: "./dist/app.js",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "400M",
      exp_backoff_restart_delay: 100,
      env: {
        NODE_ENV: "production",
        PORT: 3001
      }
    }
  ]
};
