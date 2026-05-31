-- Add colony_id and shop_id to sales for shop/plot sales
ALTER TABLE sales
    ADD COLUMN IF NOT EXISTS colony_id UUID REFERENCES colonies(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS shop_id UUID REFERENCES shops(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sales_colony ON sales(colony_id);
CREATE INDEX IF NOT EXISTS idx_sales_shop ON sales(shop_id);
