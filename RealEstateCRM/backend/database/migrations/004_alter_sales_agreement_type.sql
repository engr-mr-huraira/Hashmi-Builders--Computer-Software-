-- Migration: Alter agreement_number to TEXT type in sales table
-- This allows storing Base64 strings for files in the agreement_number column without size limit.

ALTER TABLE sales ALTER COLUMN agreement_number TYPE TEXT;
