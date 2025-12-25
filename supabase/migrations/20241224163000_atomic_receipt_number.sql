-- Migration: Make receipt number generation atomic with booking creation
-- Created: 2024-12-24
-- Description: Creates a trigger to auto-generate receipt numbers on booking insert

-- ============================================================================
-- 1. UPDATE FUNCTION FOR ATOMIC RECEIPT NUMBER GENERATION
-- ============================================================================

-- Drop the old function if it exists (we'll replace it)
DROP FUNCTION IF EXISTS get_next_receipt_number();

-- Create a new function for atomic receipt number that doesn't rely on pre-calling
CREATE OR REPLACE FUNCTION generate_receipt_number_for_booking()
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
    
    -- Lock and update the counter atomically
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
        ON CONFLICT (id) DO UPDATE SET
            counter = CASE 
                WHEN receipt_counter.last_date = today THEN receipt_counter.counter + 1 
                ELSE 1 
            END,
            last_date = today
        RETURNING counter INTO current_counter;
    END IF;
    
    -- Format date as DDMMYYYY
    current_date_str := to_char(today, 'DDMMYYYY');
    
    -- Generate the receipt number
    new_receipt_number := 'DRT-' || current_date_str || '-' || LPAD(current_counter::TEXT, 3, '0');
    
    -- Set both id and receipt_number
    NEW.receipt_number := new_receipt_number;
    IF NEW.id IS NULL OR NEW.id = '' THEN
        NEW.id := new_receipt_number;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 2. CREATE TRIGGER ON BOOKINGS TABLE
-- ============================================================================

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_generate_receipt_number ON public.bookings;

-- Create the trigger
CREATE TRIGGER trigger_generate_receipt_number
    BEFORE INSERT ON public.bookings
    FOR EACH ROW
    EXECUTE FUNCTION generate_receipt_number_for_booking();

-- ============================================================================
-- 3. RECREATE get_next_receipt_number FOR BACKWARD COMPATIBILITY
-- ============================================================================

-- Keep the old function for any code that might still use it
CREATE OR REPLACE FUNCTION get_next_receipt_number()
RETURNS TEXT AS $$
DECLARE
    current_counter INTEGER;
    current_date_str TEXT;
    today DATE := CURRENT_DATE;
BEGIN
    -- Lock and update the counter atomically
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
        ON CONFLICT (id) DO UPDATE SET
            counter = CASE 
                WHEN receipt_counter.last_date = today THEN receipt_counter.counter + 1 
                ELSE 1 
            END,
            last_date = today
        RETURNING counter INTO current_counter;
    END IF;
    
    -- Format date as DDMMYYYY
    current_date_str := to_char(today, 'DDMMYYYY');
    
    -- Return formatted receipt number
    RETURN 'DRT-' || current_date_str || '-' || LPAD(current_counter::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_receipt_number_for_booking IS 'Trigger function that automatically generates receipt numbers on booking insert';
COMMENT ON TRIGGER trigger_generate_receipt_number ON public.bookings IS 'Auto-generates receipt number when a booking is inserted without one';
