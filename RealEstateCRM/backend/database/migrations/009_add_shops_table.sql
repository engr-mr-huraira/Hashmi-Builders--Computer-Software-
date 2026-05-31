-- Shops table for commercial plots
CREATE TABLE IF NOT EXISTS shops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    colony_id UUID REFERENCES colonies(id) ON DELETE CASCADE,
    plot_id UUID REFERENCES plots(id) ON DELETE CASCADE,
    shop_number VARCHAR(50) NOT NULL,
    size DECIMAL(10, 2),
    dimensions TEXT,
    price DECIMAL(15, 2),
    status VARCHAR(20) DEFAULT 'available',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(colony_id, shop_number)
);

CREATE INDEX IF NOT EXISTS idx_shops_colony ON shops(colony_id);
CREATE INDEX IF NOT EXISTS idx_shops_plot ON shops(plot_id);
CREATE INDEX IF NOT EXISTS idx_shops_status ON shops(status);
