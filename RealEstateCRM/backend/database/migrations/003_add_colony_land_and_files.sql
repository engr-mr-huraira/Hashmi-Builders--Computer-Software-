-- Migration: Add land tracking and document files to colonies table
-- Run this against an existing database.

DO $$
BEGIN
    -- Add total_land column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'colonies' AND column_name = 'total_land'
    ) THEN
        ALTER TABLE colonies ADD COLUMN total_land DECIMAL(15, 2) DEFAULT 0;
    END IF;

    -- Add road_cut_land column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'colonies' AND column_name = 'road_cut_land'
    ) THEN
        ALTER TABLE colonies ADD COLUMN road_cut_land DECIMAL(15, 2) DEFAULT 0;
    END IF;

    -- Add remaining_land column (generated)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'colonies' AND column_name = 'remaining_land'
    ) THEN
        ALTER TABLE colonies ADD COLUMN remaining_land DECIMAL(15, 2) GENERATED ALWAYS AS (COALESCE(total_land, 0) - COALESCE(road_cut_land, 0)) STORED;
    END IF;

    -- Add bayan_file column (Court k samny bayan)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'colonies' AND column_name = 'bayan_file'
    ) THEN
        ALTER TABLE colonies ADD COLUMN bayan_file TEXT;
    END IF;

    -- Add purchase_papers_file column (Land Purchase Papers)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'colonies' AND column_name = 'purchase_papers_file'
    ) THEN
        ALTER TABLE colonies ADD COLUMN purchase_papers_file TEXT;
    END IF;

    -- Add stamp_paper_file column (e Stam Paper)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'colonies' AND column_name = 'stamp_paper_file'
    ) THEN
        ALTER TABLE colonies ADD COLUMN stamp_paper_file TEXT;
    END IF;

    -- Add payment_plan_client column (payment client ko kesy deni ha)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'colonies' AND column_name = 'payment_plan_client'
    ) THEN
        ALTER TABLE colonies ADD COLUMN payment_plan_client VARCHAR(50);
    END IF;
END $$;
