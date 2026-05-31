-- Real Estate CRM Database Schema
-- PostgreSQL Schema for Offline-First CRM Application

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users and Roles
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    permissions JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    role_id INTEGER REFERENCES roles(id),
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Colonies/Projects
CREATE TABLE IF NOT EXISTS colonies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) UNIQUE NOT NULL,
    location TEXT,
    total_plots INTEGER DEFAULT 0,
    description TEXT,
    map_image TEXT,
    -- Acquisition / purchase tracking
    purchase_from VARCHAR(150),          -- Client / vendor we bought the land from
    purchase_amount DECIMAL(15, 2),      -- Total purchase price
    advance_paid DECIMAL(15, 2) DEFAULT 0, -- Advance already paid
    remaining_amount DECIMAL(15, 2) GENERATED ALWAYS AS (COALESCE(purchase_amount, 0) - COALESCE(advance_paid, 0)) STORED,
    total_land DECIMAL(15, 2) DEFAULT 0,  -- Total Land in Marlas
    road_cut_land DECIMAL(15, 2) DEFAULT 0, -- Road cut land in Marlas
    remaining_land DECIMAL(15, 2) GENERATED ALWAYS AS (COALESCE(total_land, 0) - COALESCE(road_cut_land, 0)) STORED,
    bayan_file TEXT,                     -- Court k samny bayan file (Base64)
    purchase_papers_file TEXT,           -- Land Purchase Papers file (Base64)
    stamp_paper_file TEXT,               -- e Stam Paper file (Base64)
    payment_plan_client VARCHAR(50),     -- payment client ko kesy deni ha (Quarterly, Yearly, 6 Months)
    clearance_duration VARCHAR(100),     -- Time to clear payments to vendor/client
    status VARCHAR(20) DEFAULT 'active',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Blocks/Sectors
CREATE TABLE IF NOT EXISTS blocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    colony_id UUID REFERENCES colonies(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    type VARCHAR(20) DEFAULT 'block',
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Plots
CREATE TABLE IF NOT EXISTS plots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    colony_id UUID REFERENCES colonies(id) ON DELETE CASCADE,
    block_id UUID REFERENCES blocks(id) ON DELETE SET NULL,
    plot_number VARCHAR(50) NOT NULL,
    plot_size DECIMAL(10, 2),
    plot_category VARCHAR(50),
    plot_type VARCHAR(20) DEFAULT 'residential',
    dimensions TEXT,
    is_corner BOOLEAN DEFAULT false,
    is_facing_park BOOLEAN DEFAULT false,
    is_commercial BOOLEAN DEFAULT false,
    price_per_marla DECIMAL(12, 2),
    total_price DECIMAL(15, 2),
    status VARCHAR(20) DEFAULT 'available',
    booking_date TIMESTAMP,
    current_owner_id UUID,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(colony_id, plot_number)
);

-- Customers
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name VARCHAR(100) NOT NULL,
    cnic VARCHAR(15) UNIQUE NOT NULL,
    phone VARCHAR(20) NOT NULL,
    secondary_phone VARCHAR(20),
    email VARCHAR(100),
    address TEXT,
    city VARCHAR(50),
    province VARCHAR(50),
    occupation VARCHAR(50),
    nominee_name VARCHAR(100),
    nominee_cnic VARCHAR(15),
    nominee_relation VARCHAR(50),
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sales/Bookings
CREATE TABLE IF NOT EXISTS sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plot_id UUID REFERENCES plots(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    sale_number VARCHAR(50) UNIQUE NOT NULL,
    sale_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    booking_amount DECIMAL(15, 2),
    total_price DECIMAL(15, 2),
    discount_amount DECIMAL(15, 2) DEFAULT 0,
    payment_plan VARCHAR(50),
    installment_months INTEGER,
    monthly_installment DECIMAL(15, 2),
    down_payment DECIMAL(15, 2),
    status VARCHAR(20) DEFAULT 'active',
    agreement_number TEXT,
    transfer_count INTEGER DEFAULT 0,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Installments
CREATE TABLE IF NOT EXISTS installments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_id UUID REFERENCES sales(id) ON DELETE CASCADE,
    installment_number INTEGER NOT NULL,
    due_date TIMESTAMP NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    paid_amount DECIMAL(15, 2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending',
    payment_date TIMESTAMP,
    late_fee DECIMAL(15, 2) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_id UUID REFERENCES sales(id) ON DELETE CASCADE,
    installment_id UUID REFERENCES installments(id) ON DELETE SET NULL,
    payment_number VARCHAR(50) UNIQUE NOT NULL,
    payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    amount DECIMAL(15, 2) NOT NULL,
    payment_method VARCHAR(50),
    bank_name VARCHAR(100),
    cheque_number VARCHAR(50),
    transaction_id TEXT,
    receipt_number VARCHAR(50),
    notes TEXT,
    received_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Refunds
CREATE TABLE IF NOT EXISTS refunds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_id UUID REFERENCES sales(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id),
    refund_number VARCHAR(50) UNIQUE NOT NULL,
    request_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    refund_amount DECIMAL(15, 2),
    deduction_amount DECIMAL(15, 2) DEFAULT 0,
    deduction_reason TEXT,
    approval_status VARCHAR(20) DEFAULT 'pending',
    approved_by UUID REFERENCES users(id),
    approved_date TIMESTAMP,
    refund_date TIMESTAMP,
    payment_method VARCHAR(50),
    bank_name VARCHAR(100),
    cheque_number VARCHAR(50),
    transaction_id TEXT,
    bank_details TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Financial Transactions
CREATE TABLE IF NOT EXISTS financial_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_type VARCHAR(20) NOT NULL,
    colony_id UUID REFERENCES colonies(id) ON DELETE SET NULL,
    category VARCHAR(50) NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    description TEXT,
    reference_id UUID,
    reference_type VARCHAR(50),
    transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Accounts
CREATE TABLE IF NOT EXISTS accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_name VARCHAR(100) NOT NULL,
    account_type VARCHAR(50) NOT NULL,
    account_number VARCHAR(50),
    bank_name VARCHAR(100),
    branch_name VARCHAR(100),
    opening_balance DECIMAL(15, 2) DEFAULT 0,
    current_balance DECIMAL(15, 2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Documents
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    document_type VARCHAR(50) NOT NULL,
    document_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT,
    file_type VARCHAR(50),
    uploaded_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    notification_type VARCHAR(50),
    reference_id UUID,
    reference_type VARCHAR(50),
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Activity Logs
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sync Logs
CREATE TABLE IF NOT EXISTS sync_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sync_type VARCHAR(20) NOT NULL,
    direction VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,
    records_synced INTEGER DEFAULT 0,
    records_failed INTEGER DEFAULT 0,
    error_message TEXT,
    sync_started_at TIMESTAMP,
    sync_completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sync Queue
CREATE TABLE IF NOT EXISTS sync_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name VARCHAR(50) NOT NULL,
    record_id UUID NOT NULL,
    operation VARCHAR(20) NOT NULL,
    data JSONB,
    status VARCHAR(20) DEFAULT 'pending',
    retry_count INTEGER DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP
);

-- Settings
CREATE TABLE IF NOT EXISTS settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT,
    description TEXT,
    updated_by UUID REFERENCES users(id),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_plots_colony ON plots(colony_id);
CREATE INDEX IF NOT EXISTS idx_plots_block ON plots(block_id);
CREATE INDEX IF NOT EXISTS idx_plots_status ON plots(status);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_plot ON sales(plot_id);
CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);
CREATE INDEX IF NOT EXISTS idx_payments_sale ON payments(sale_id);
CREATE INDEX IF NOT EXISTS idx_installments_sale ON installments(sale_id);
CREATE INDEX IF NOT EXISTS idx_installments_due ON installments(due_date);
CREATE INDEX IF NOT EXISTS idx_installments_status ON installments(status);
CREATE INDEX IF NOT EXISTS idx_documents_entity ON documents(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON activity_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status);
CREATE INDEX IF NOT EXISTS idx_sync_queue_table ON sync_queue(table_name);

-- Insert default roles
INSERT INTO roles (name, description, permissions) VALUES
('Super Admin', 'Full system access', '["all"]'),
('Admin', 'Administrative access', '["dashboard","colonies","plots","customers","sales","payments","refunds","financial","documents","reports","users"]'),
('Accountant', 'Financial management', '["dashboard","payments","refunds","financial","reports"]'),
('Sales Manager', 'Sales and customer management', '["dashboard","colonies","plots","customers","sales","payments","reports"]'),
('Data Entry Operator', 'Basic data entry', '["dashboard","colonies","plots","customers"]')
ON CONFLICT (name) DO NOTHING;

-- NOTE: The default admin user is seeded at runtime by the Electron main process
-- (electron/main/main.js -> ensureDatabase) using a real bcrypt hash. The
-- previous placeholder hash here ('$2a$10$YourHashedPasswordHere') was invalid
-- and would cause every login attempt to fail.

-- Insert default settings
INSERT INTO settings (key, value, description) VALUES
('company_name', 'Hashmi Builders', 'Company name'),
('company_address', '', 'Company address'),
('company_phone', '', 'Company phone'),
('company_email', '', 'Company email'),
('default_currency', 'PKR', 'Default currency'),
('tax_rate', '0', 'Tax rate percentage'),
('late_fee_rate', '0', 'Late fee rate percentage'),
('backup_enabled', 'true', 'Enable automatic backups'),
('sync_enabled', 'false', 'Enable cloud sync')
ON CONFLICT (key) DO NOTHING;
