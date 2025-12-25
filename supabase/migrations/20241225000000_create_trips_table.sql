-- Migration: Create trips table
-- Created: 2024-12-25
-- Description: Creates the trips table for managing transport trips

-- ============================================================================
-- 1. CREATE TRIPS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.trips (
    id TEXT PRIMARY KEY,
    trip_number TEXT UNIQUE,
    trip_type TEXT DEFAULT 'origin', -- 'origin' or 'forwarding'
    driver_name TEXT NOT NULL,
    driver_phone TEXT,
    vehicle_number TEXT NOT NULL,
    trip_cost DECIMAL(10,2) DEFAULT 0,
    origin_depot_id UUID REFERENCES public.depots(id),
    destination_depot_id UUID REFERENCES public.depots(id),
    departure_time TIMESTAMPTZ DEFAULT NOW(),
    arrival_time TIMESTAMPTZ,
    expected_delivery_date DATE,
    status TEXT DEFAULT 'planned', -- planned, in_transit, completed, cancelled
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 2. CREATE TRIP_BOOKINGS JUNCTION TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.trip_bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id TEXT REFERENCES public.trips(id) ON DELETE CASCADE,
    booking_id TEXT REFERENCES public.bookings(id) ON DELETE CASCADE,
    loaded_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(trip_id, booking_id)
);

-- ============================================================================
-- 3. TRIP NUMBER COUNTER
-- ============================================================================

-- Add trip counter columns to receipt_counter (singleton table)
ALTER TABLE public.receipt_counter
    ADD COLUMN IF NOT EXISTS trip_counter INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS trip_last_date DATE DEFAULT CURRENT_DATE;

-- Function to generate trip number
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
    
    current_date_str := to_char(today, 'DDMMYYYY');
    
    RETURN 'TRIP-' || current_date_str || '-' || LPAD(current_counter::TEXT, 3, '0');
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

DROP TRIGGER IF EXISTS trips_auto_number ON public.trips;
CREATE TRIGGER trips_auto_number
    BEFORE INSERT ON public.trips
    FOR EACH ROW
    EXECUTE FUNCTION set_trip_number();

-- ============================================================================
-- 4. ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all trips access" ON public.trips;
CREATE POLICY "Allow all trips access" ON public.trips FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all trip_bookings access" ON public.trip_bookings;
CREATE POLICY "Allow all trip_bookings access" ON public.trip_bookings FOR ALL USING (true);

-- ============================================================================
-- 5. INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_trips_status ON public.trips(status);
CREATE INDEX IF NOT EXISTS idx_trips_departure ON public.trips(departure_time);
CREATE INDEX IF NOT EXISTS idx_trip_bookings_trip ON public.trip_bookings(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_bookings_booking ON public.trip_bookings(booking_id);
