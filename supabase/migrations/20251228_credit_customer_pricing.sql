-- Credit Customer Discount Calculator
-- Migration: Create credit_customers and credit_customer_pricing tables

-- ============================================
-- 1. credit_customers table
-- Stores canonical display name per phone number
-- ============================================
CREATE TABLE IF NOT EXISTS credit_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT UNIQUE NOT NULL,           -- Primary identifier (unique)
  display_name TEXT NOT NULL,           -- Canonical name (admin-editable)
  notes TEXT,                           -- Optional notes about customer
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast phone lookups
CREATE INDEX IF NOT EXISTS idx_credit_customers_phone ON credit_customers(phone);

-- ============================================
-- 2. credit_customer_pricing table
-- Stores discounted prices per customer per package per depot
-- ============================================
CREATE TABLE IF NOT EXISTS credit_customer_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_phone TEXT NOT NULL,
  package_id UUID NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  depot_id UUID NOT NULL REFERENCES depots(id) ON DELETE CASCADE,
  discounted_price NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Unique constraint: one price per customer-package-depot combination
  UNIQUE(customer_phone, package_id, depot_id)
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_credit_customer_pricing_phone ON credit_customer_pricing(customer_phone);
CREATE INDEX IF NOT EXISTS idx_credit_customer_pricing_package ON credit_customer_pricing(package_id);
CREATE INDEX IF NOT EXISTS idx_credit_customer_pricing_depot ON credit_customer_pricing(depot_id);

-- ============================================
-- 3. RLS Policies (if enabled)
-- ============================================
-- Enable RLS
ALTER TABLE credit_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_customer_pricing ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated users (admin-only feature)
CREATE POLICY "credit_customers_all" ON credit_customers
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "credit_customer_pricing_all" ON credit_customer_pricing
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- 4. Updated_at trigger function (if not exists)
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
DROP TRIGGER IF EXISTS update_credit_customers_updated_at ON credit_customers;
CREATE TRIGGER update_credit_customers_updated_at
  BEFORE UPDATE ON credit_customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_credit_customer_pricing_updated_at ON credit_customer_pricing;
CREATE TRIGGER update_credit_customer_pricing_updated_at
  BEFORE UPDATE ON credit_customer_pricing
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
