-- Migration: Fix trip number format to TRP-DDMMYYYY-XXX
-- Created: 2024-12-25
-- Description: Updates the trip number format from TRIP- to TRP-

-- Function to generate trip number with TRP prefix
CREATE OR REPLACE FUNCTION get_next_trip_number()
RETURNS TEXT AS $$
DECLARE
    current_counter INTEGER;
    current_date_str TEXT;
    today DATE := CURRENT_DATE;
BEGIN
    UPDATE public.receipt_counter
    SET 
        trip_counter = CASE 
            WHEN trip_last_date = today THEN COALESCE(trip_counter, 0) + 1 
            ELSE 1 
        END,
        trip_last_date = today
    WHERE id = 1
    RETURNING trip_counter INTO current_counter;
    
    IF current_counter IS NULL THEN
        INSERT INTO public.receipt_counter (id, trip_last_date, trip_counter)
        VALUES (1, today, 1)
        ON CONFLICT (id) DO UPDATE SET trip_counter = 1, trip_last_date = today
        RETURNING trip_counter INTO current_counter;
    END IF;
    
    -- Format: TRP-DDMMYYYY-XXX
    current_date_str := to_char(today, 'DDMMYYYY');
    
    RETURN 'TRP-' || current_date_str || '-' || LPAD(current_counter::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate trip number
CREATE OR REPLACE FUNCTION set_trip_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.trip_number IS NULL OR NEW.trip_number = '' THEN
        NEW.trip_number := get_next_trip_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger
DROP TRIGGER IF EXISTS trips_auto_number ON public.trips;
CREATE TRIGGER trips_auto_number
    BEFORE INSERT ON public.trips
    FOR EACH ROW
    EXECUTE FUNCTION set_trip_number();
