-- Migration: Add bank_name, cheque_number, and transaction_id to refunds table
-- This allows storing details for cheque and bank transfer refund methods.

ALTER TABLE refunds ADD COLUMN bank_name VARCHAR(100);
ALTER TABLE refunds ADD COLUMN cheque_number VARCHAR(50);
ALTER TABLE refunds ADD COLUMN transaction_id TEXT;
