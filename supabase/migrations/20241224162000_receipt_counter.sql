-- Migration: Add receipt counter and package description
-- Created: 2024-12-24
-- Description: Adds serialized receipt number counter and package description field

-- ============================================================================
-- 1. CREATE RECEIPT COUNTER TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.receipt_counter (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1), -- Singleton row
    last_date DATE NOT NULL DEFAULT CURRENT_DATE,
    counter INTEGER NOT NULL DEFAULT 0
);

-- Initialize the counter
INSERT INTO public.receipt_counter (id, last_date, counter)
VALUES (1, CURRENT_DATE, 0)
ON CONFLICT (id) DO NOTHING;

-- Add RLS policy
ALTER TABLE public.receipt_counter ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access" ON public.receipt_counter;
CREATE POLICY "Allow all access" ON public.receipt_counter FOR ALL USING (true);

-- ============================================================================
-- 2. FUNCTION TO GET NEXT RECEIPT NUMBER
-- ============================================================================

CREATE OR REPLACE FUNCTION get_next_receipt_number()
RETURNS TEXT AS $$
DECLARE
    current_counter INTEGER;
    current_date_str TEXT;
    today DATE := CURRENT_DATE;
BEGIN
    -- Lock the counter row for update
    UPDATE public.receipt_counter
    SET 
        counter = CASE 
            WHEN last_date = today THEN counter + 1 
            ELSE 1 
        END,
        last_date = today
    WHERE id = 1
    RETURNING counter INTO current_counter;
    
    -- If no row exists, create one
    IF current_counter IS NULL THEN
        INSERT INTO public.receipt_counter (id, last_date, counter)
        VALUES (1, today, 1)
        RETURNING counter INTO current_counter;
    END IF;
    
    -- Format date as DDMMYYYY
    current_date_str := to_char(today, 'DDMMYYYY');
    
    -- Return formatted receipt number (3-digit padded counter)
    RETURN 'DRT-' || current_date_str || '-' || LPAD(current_counter::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 3. ADD PACKAGE DESCRIPTION COLUMN
-- ============================================================================

ALTER TABLE public.receiver_packages
    ADD COLUMN IF NOT EXISTS description TEXT;

COMMENT ON COLUMN public.receiver_packages.description IS 'Optional description for custom/other package types';

-- ============================================================================
-- 4. UPDATE BOOKINGS_COMPLETE VIEW TO INCLUDE DESCRIPTION
-- ============================================================================

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
                            'total_price', rp.total_price,
                            'description', rp.description
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
