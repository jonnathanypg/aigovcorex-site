# DEPLOY VPS CMCI (MariaDB) — qué se instala y qué se crea en BD
**Cuándo:** después de `deploy.sh` en cada deploy que incluya CMCI. **Idempotente:** se puede correr N veces.

## 1. En el VPS (una vez por deploy)
```bash
cd ~/aigovcorex
git pull # o el tar del workflow, según tu flujo
cd backend/modules/early-childhood
python3 -m venv venv 2>/dev/null; source venv/bin/activate
python3 scripts/cmci_provision.py
sudo systemctl reload nginx || sudo service nginx reload
pm2 restart ecosystem.config.js --update-env && pm2 save
curl -s http://localhost:5000/health
```

## 2. Qué instala solo (`scripts/cmci_provision.py` pasos 1-2)
- Lee `requirements.txt` e instala lo faltante con pip (omite `faster-whisper`/`pandas` a propósito, py3.13/3.14).
- Claves CMCI: `Flask-CORS`, `PyMySQL`, `reportlab`, `openpyxl`, `edge-tts`, `phonenumbers`, `pydantic`, `python-dotenv`.
- Backup previo: `mysqldump` si existe → `backups/`; si no hay cliente, avisa y sigue (no borra nada).

## 3. Qué crea/ajusta en MariaDB (pasos 3-5, sin borrar datos)
- Quita UNIQUEs legacy globales (bloqueaban histórico/multicentro):
  `vulnerability_forms.child_id`, `children.cedula`, `representatives.cedula`.
- Crea índices nuevos: `idx_vuln_child`, `uq_child_tenant_cedula`, `uq_rep_family_cedula`, `idx_tenant_cmci_code`.
- `db.create_all()` crea si no existen: `cmci_centers`, `vulnerability_assessments`, `socioeconomic_assessments`, `scoring_params`, `country_configs`, `document_templates`, `monthly_reports` (+ `food_intake_receptions` F4) y columnas `tenants.cmci_code/country_iso` (vía `app.py` ALTER idempotente).
- Seeds si vacíos: `scoring_params v1_validada_2026-09-25` (pesos/rangos/umbrales/98 opciones) + `country_configs EC` (593, cédula módulo-10, America/Guayaquil, USD).
- MariaDB: `db.JSON` se guarda como LONGTEXT (10.2+); `utf8mb4` ya en URI.

## 4. Verificación (paso 6, sale `PROVISION_OK`)
- Tablas presentes, 1 `compute` determinista smoke, conteos seeds.
- Si algo falla, el script aborta con el error exacto antes de tocar PM2/nginx.

## 5. Checklist post-deploy
- [ ] `PROVISION_OK` en salida
- [ ] `curl localhost:5000/health` 200
- [ ] `pm2 status` 4 apps online
- [ ] Login dashboard + abrir `/admision/priorizacion` (debe cargar, aunque vacío)
