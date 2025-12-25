-- Migration: Update bookings schema for multi-receiver support
-- Created: 2024-12-24
-- Description: Adds normalized tables for receivers and packages per receiver

-- ============================================================================
-- 1. UPDATE BOOKINGS TABLE
-- ============================================================================

-- Add new columns to existing bookings table
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS receipt_number TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS origin_depot_id UUID REFERENCES public.depots(id),
  ADD COLUMN IF NOT EXISTS destination_depot_id UUID REFERENCES public.depots(id),
  ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'cash',
  ADD COLUMN IF NOT EXISTS delivery_type TEXT DEFAULT 'pickup',
  ADD COLUMN IF NOT EXISTS delivery_charges DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sender_name TEXT,
  ADD COLUMN IF NOT EXISTS sender_phone TEXT,
  ADD COLUMN IF NOT EXISTS subtotal DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS custom_instructions TEXT;

-- Make old required fields nullable for backward compatibility
ALTER TABLE public.bookings
  ALTER COLUMN customer_name DROP NOT NULL,
  ALTER COLUMN customer_phone DROP NOT NULL,
  ALTER COLUMN origin_location DROP NOT NULL,
  ALTER COLUMN destination_location DROP NOT NULL;

-- Add index on receipt_number for faster lookups
CREATE INDEX IF NOT EXISTS idx_bookings_receipt_number ON public.bookings(receipt_number);

-- Add indexes on depot foreign keys
CREATE INDEX IF NOT EXISTS idx_bookings_origin_depot ON public.bookings(origin_depot_id);
CREATE INDEX IF NOT EXISTS idx_bookings_destination_depot ON public.bookings(destination_depot_id);

-- ============================================================================
-- 2. CREATE BOOKING_RECEIVERS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.booking_receivers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id TEXT NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    receiver_name TEXT NOT NULL,
    receiver_phone TEXT NOT NULL,
    delivery_address TEXT,
    receiver_order INTEGER DEFAULT 1, -- Order of receivers (1st, 2nd, etc.)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_booking_receivers_booking_id ON public.booking_receivers(booking_id);

-- Add RLS policy
ALTER TABLE public.booking_receivers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access" ON public.booking_receivers FOR ALL USING (true);

-- ============================================================================
-- 3. CREATE RECEIVER_PACKAGES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.receiver_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receiver_id UUID NOT NULL REFERENCES public.booking_receivers(id) ON DELETE CASCADE,
    package_id UUID REFERENCES public.packages(id), -- NULL for custom packages
    package_size TEXT NOT NULL, -- e.g., "2Dz", "5Dz", "Custom"
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    price_per_unit DECIMAL(10,2) NOT NULL CHECK (price_per_unit >= 0),
    total_price DECIMAL(10,2) GENERATED ALWAYS AS (quantity * price_per_unit) STORED,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_receiver_packages_receiver_id ON public.receiver_packages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_receiver_packages_package_id ON public.receiver_packages(package_id);

-- Add RLS policy
ALTER TABLE public.receiver_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access" ON public.receiver_packages FOR ALL USING (true);

-- ============================================================================
-- 4. CREATE HELPER VIEWS
-- ============================================================================

-- View to get complete booking details with receivers and packages
CREATE OR REPLACE VIEW public.bookings_complete AS
SELECT 
    b.*,
    od.name as origin_depot_name,
    dd.name as destination_depot_name,
    (
        SELECT json_agg(
            json_build_object(
                'id', br.id,
                'name', br.receiver_name,
                'phone', br.receiver_phone,
                'address', br.delivery_address,
                'order', br.receiver_order,
                'packages', (
                    SELECT json_agg(
                        json_build_object(
                            'id', rp.id,
                            'package_id', rp.package_id,
                            'size', rp.package_size,
                            'quantity', rp.quantity,
                            'price_per_unit', rp.price_per_unit,
                            'total_price', rp.total_price
                        )
                    )
                    FROM public.receiver_packages rp
                    WHERE rp.receiver_id = br.id
                )
            )
            ORDER BY br.receiver_order
        )
        FROM public.booking_receivers br
        WHERE br.booking_id = b.id
    ) as receivers
FROM public.bookings b
LEFT JOIN public.depots od ON b.origin_depot_id = od.id
LEFT JOIN public.depots dd ON b.destination_depot_id = dd.id;

-- ============================================================================
-- 5. CREATE HELPER FUNCTIONS
-- ============================================================================

-- Function to calculate booking total
CREATE OR REPLACE FUNCTION calculate_booking_total(booking_id_param TEXT)
RETURNS DECIMAL(10,2) AS $$
DECLARE
    packages_total DECIMAL(10,2);
    delivery_charge DECIMAL(10,2);
BEGIN
    -- Sum all package totals for this booking
    SELECT COALESCE(SUM(rp.total_price), 0)
    INTO packages_total
    FROM public.receiver_packages rp
    JOIN public.booking_receivers br ON rp.receiver_id = br.id
    WHERE br.booking_id = booking_id_param;
    
    -- Get delivery charges
    SELECT COALESCE(delivery_charges, 0)
    INTO delivery_charge
    FROM public.bookings
    WHERE id = booking_id_param;
    
    RETURN packages_total + delivery_charge;
END;
$$ LANGUAGE plpgsql;

-- Function to update booking subtotal (trigger)
CREATE OR REPLACE FUNCTION update_booking_subtotal()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.bookings
    SET subtotal = calculate_booking_total(NEW.booking_id),
        total_amount = calculate_booking_total(NEW.booking_id)
    WHERE id = NEW.booking_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update booking totals when packages change
DROP TRIGGER IF EXISTS trigger_update_booking_subtotal ON public.receiver_packages;
CREATE TRIGGER trigger_update_booking_subtotal
    AFTER INSERT OR UPDATE OR DELETE ON public.receiver_packages
    FOR EACH ROW
    EXECUTE FUNCTION update_booking_subtotal();

-- ============================================================================
-- 6. ADD COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE public.booking_receivers IS 'Stores receiver information for each booking. One booking can have multiple receivers.';
COMMENT ON TABLE public.receiver_packages IS 'Stores package details for each receiver. Each receiver can have multiple packages.';
COMMENT ON COLUMN public.bookings.receipt_number IS 'Unique receipt number in format DRT-DDMMYYYY-XXX';
COMMENT ON COLUMN public.bookings.delivery_type IS 'Type of delivery: pickup, home_sender, home_topay, home_drt';
COMMENT ON COLUMN public.booking_receivers.receiver_order IS 'Order of receiver in the booking (1st receiver, 2nd receiver, etc.)';
COMMENT ON FUNCTION calculate_booking_total IS 'Calculates total amount for a booking including all packages and delivery charges';

-- ============================================================================
-- 7. GRANT PERMISSIONS (if needed)
-- ============================================================================

-- Grant permissions to authenticated users (adjust as needed)
-- GRANT ALL ON public.booking_receivers TO authenticated;
-- GRANT ALL ON public.receiver_packages TO authenticated;
