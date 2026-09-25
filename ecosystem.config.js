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
      args: "start -p 3002",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production",
        PORT: 3002
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
      args: "wsgi:app --bind 0.0.0.0:5000 --workers 4 --threads 4 --worker-class gthread --timeout 120",
      interpreter: "none",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "600M",
      exp_backoff_restart_delay: 100,
      env: {
        FLASK_ENV: "production",
        PORT: 5000,
        LANGFUSE_BASE_URL: process.env.LANGFUSE_BASE_URL || "https://labmonitor.weblifetech.com",
        LANGFUSE_HOST: process.env.LANGFUSE_HOST || "https://labmonitor.weblifetech.com",
        LANGFUSE_PUBLIC_KEY: process.env.LANGFUSE_PUBLIC_KEY || "pk-lf-6a78bfc3-4404-4904-a6a1-99b569e57dee",
        LANGFUSE_SECRET_KEY: process.env.LANGFUSE_SECRET_KEY || "sk-lf-f63d7d1a-d8ba-4059-b665-fd40c8963106"
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
