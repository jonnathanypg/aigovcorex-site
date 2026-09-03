-- ════════════════════════════════════════════════════════════════════════════════
-- AI GovCoreX OS — SQL Migration: Platform Licensing & Module System
-- ════════════════════════════════════════════════════════════════════════════════

-- 1. Add module control and platform columns to licenses table
ALTER TABLE licenses 
  ADD COLUMN IF NOT EXISTS enabled_modules TEXT NULL,
  ADD COLUMN IF NOT EXISTS max_users INT DEFAULT 50,
  ADD COLUMN IF NOT EXISTS storage_quota_mb INT DEFAULT 1024,
  ADD COLUMN IF NOT EXISTS allow_public_chatbot BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS allow_whatsapp_public BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS allow_telegram_public BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS public_org_slug VARCHAR(100) UNIQUE NULL;

-- 2. Populate default modules for all existing licenses
UPDATE licenses 
SET enabled_modules = '["kindicore","social","geo","channels","copilot"]'
WHERE enabled_modules IS NULL;

-- 3. Set default public slug based on license name if missing
UPDATE licenses 
SET public_org_slug = CONCAT('org-', id)
WHERE public_org_slug IS NULL;
