-- Migration: Alter transaction_id to TEXT in payments table
-- This allows storing bank transfer receipt files (Base64) in transaction_id column.

ALTER TABLE payments ALTER COLUMN transaction_id TYPE TEXT;
