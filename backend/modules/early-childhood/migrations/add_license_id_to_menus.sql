-- ================================================================
-- Migration: Add license_id column to menus table
-- Feature: Global Weekly Menu for License Admins
-- Date: 2026-02-22
-- ================================================================
-- This script is IDEMPOTENT: safe to run multiple times.
-- Run this ONLY if the 'menus' table already exists in your database.
-- If the table was just created by db.create_all(), this is NOT needed.
-- ================================================================

-- 1. Add the license_id column (nullable)
ALTER TABLE menus ADD COLUMN IF NOT EXISTS license_id INT NULL;

-- 2. Make tenant_id nullable (it was NOT NULL before)
ALTER TABLE menus MODIFY COLUMN tenant_id INT NULL;

-- 3. Add foreign key constraint for license_id
-- First check if it doesn't already exist
SET @fk_exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS 
    WHERE CONSTRAINT_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'menus' 
    AND CONSTRAINT_NAME = 'fk_menus_license_id');

SET @sql = IF(@fk_exists = 0,
    'ALTER TABLE menus ADD CONSTRAINT fk_menus_license_id FOREIGN KEY (license_id) REFERENCES licenses(id) ON DELETE CASCADE',
    'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 4. Add index for faster lookups by license + week
CREATE INDEX IF NOT EXISTS idx_menu_license_week ON menus (license_id, week_start_date);

-- ================================================================
-- VERIFICATION: Run this query to confirm the columns exist
-- ================================================================
-- DESCRIBE menus;
-- Expected columns: id, tenant_id (NULL), license_id (NULL), 
--   week_start_date, day_of_week, meal_type, description, 
--   ingredients, calories, created_by_id, created_at, updated_at
