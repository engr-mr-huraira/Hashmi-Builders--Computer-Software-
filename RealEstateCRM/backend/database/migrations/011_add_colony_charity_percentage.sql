-- Add charity percentage to colonies
ALTER TABLE colonies ADD COLUMN IF NOT EXISTS charity_percentage DECIMAL(5, 2) DEFAULT 0;

-- Ensure charity_percentage is between 0 and 100
UPDATE colonies SET charity_percentage = 0 WHERE charity_percentage IS NULL;
