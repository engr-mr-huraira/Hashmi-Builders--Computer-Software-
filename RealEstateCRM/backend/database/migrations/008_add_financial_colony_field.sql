-- Migration 008: Add colony_id column to financial_transactions table
-- This allows tracking which colony an expense belongs to.

ALTER TABLE financial_transactions ADD COLUMN colony_id UUID REFERENCES colonies(id) ON DELETE SET NULL;
