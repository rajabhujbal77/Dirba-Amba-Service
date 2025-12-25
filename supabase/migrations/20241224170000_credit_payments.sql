-- Migration: Credit Payments Table
-- Created: 2024-12-24
-- Description: Creates table to track advance payments from credit customers

-- ============================================================================
-- 1. CREATE CREDIT PAYMENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.credit_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  payment_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  payment_method TEXT DEFAULT 'cash', -- cash, upi, bank_transfer
  receipt_number TEXT, -- Generated receipt for the payment
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 2. CREATE INDEX FOR FAST LOOKUPS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_credit_payments_customer 
  ON public.credit_payments(customer_name, customer_phone);

CREATE INDEX IF NOT EXISTS idx_credit_payments_date 
  ON public.credit_payments(payment_date DESC);

-- ============================================================================
-- 3. ADD PAYMENT COUNTER TO RECEIPT_COUNTER TABLE
-- ============================================================================

-- Add columns for payment counter (if receipt_counter table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'receipt_counter') THEN
        -- Add payment counter columns if they don't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'receipt_counter' AND column_name = 'payment_counter') THEN
            ALTER TABLE public.receipt_counter ADD COLUMN payment_counter INTEGER DEFAULT 0;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'receipt_counter' AND column_name = 'payment_last_date') THEN
            ALTER TABLE public.receipt_counter ADD COLUMN payment_last_date DATE DEFAULT CURRENT_DATE;
        END IF;
    ELSE
        -- Create receiptin case it doesn't exist
        CREATE TABLE public.receipt_counter (
            id INTEGER PRIMARY KEY DEFAULT 1,
            last_date DATE DEFAULT CURRENT_DATE,
            counter INTEGER DEFAULT 0,
            payment_counter INTEGER DEFAULT 0,
            payment_last_date DATE DEFAULT CURRENT_DATE
        );
        INSERT INTO public.receipt_counter (id, last_date, counter, payment_counter, payment_last_date)
        VALUES (1, CURRENT_DATE, 0, 0, CURRENT_DATE)
        ON CONFLICT (id) DO NOTHING;
    END IF;
END $$;

-- ============================================================================
-- 4. FUNCTION TO GENERATE PAYMENT RECEIPT NUMBER (ATOMIC)
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_payment_receipt_number()
RETURNS TRIGGER AS $$
DECLARE
    current_counter INTEGER;
    current_date_str TEXT;
    today DATE := CURRENT_DATE;
    new_receipt_number TEXT;
BEGIN
    -- Only generate if receipt_number is null or empty
    IF NEW.receipt_number IS NOT NULL AND NEW.receipt_number != '' THEN
        RETURN NEW;
    END IF;
    
    -- Atomically update and get the counter
    UPDATE public.receipt_counter
    SET 
        payment_counter = CASE 
            WHEN payment_last_date = today THEN payment_counter + 1 
            ELSE 1 
        END,
        payment_last_date = today
    WHERE id = 1
    RETURNING payment_counter INTO current_counter;
    
    -- If no row exists, create one
    IF current_counter IS NULL THEN
        INSERT INTO public.receipt_counter (id, payment_last_date, payment_counter)
        VALUES (1, today, 1)
        ON CONFLICT (id) DO UPDATE SET
            payment_counter = CASE 
                WHEN receipt_counter.payment_last_date = today THEN receipt_counter.payment_counter + 1 
                ELSE 1 
            END,
            payment_last_date = today
        RETURNING payment_counter INTO current_counter;
    END IF;
    
    -- Format date as DDMMYYYY
    current_date_str := to_char(today, 'DDMMYYYY');
    
    -- Generate the receipt number with ADV prefix
    new_receipt_number := 'ADV-' || current_date_str || '-' || LPAD(current_counter::TEXT, 3, '0');
    
    NEW.receipt_number := new_receipt_number;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5. CREATE TRIGGER FOR AUTO RECEIPT NUMBER
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_generate_payment_receipt ON public.credit_payments;

CREATE TRIGGER trigger_generate_payment_receipt
    BEFORE INSERT ON public.credit_payments
    FOR EACH ROW
    EXECUTE FUNCTION generate_payment_receipt_number();

-- ============================================================================
-- 5. ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.credit_payments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (make migration idempotent)
DROP POLICY IF EXISTS "Allow authenticated read" ON public.credit_payments;
DROP POLICY IF EXISTS "Allow authenticated insert" ON public.credit_payments;
DROP POLICY IF EXISTS "Allow authenticated update" ON public.credit_payments;

-- Allow authenticated users to read all payments
CREATE POLICY "Allow authenticated read" ON public.credit_payments
    FOR SELECT TO authenticated USING (true);

-- Allow authenticated users to insert payments
CREATE POLICY "Allow authenticated insert" ON public.credit_payments
    FOR INSERT TO authenticated WITH CHECK (true);

-- Allow authenticated users to update their own payments
CREATE POLICY "Allow authenticated update" ON public.credit_payments
    FOR UPDATE TO authenticated USING (true);

COMMENT ON TABLE public.credit_payments IS 'Tracks advance payments from credit customers';
COMMENT ON COLUMN public.credit_payments.receipt_number IS 'Auto-generated receipt number in format ADV-DDMMYYYY-XXX';
