-- Migration: Trip-Receipt Integration & Auto-Completion
-- Created: 2024-12-25
-- Description: Links receipts to trips and auto-completes trip when all receipts delivered

-- ============================================================================
-- 1. ADD COLUMNS TO BOOKINGS TABLE
-- ============================================================================

-- Add trip_id to link bookings to their assigned trip
ALTER TABLE IF EXISTS public.bookings 
    ADD COLUMN IF NOT EXISTS trip_id TEXT REFERENCES public.trips(id);

-- Add current_location_depot_id to track where receipt currently is
ALTER TABLE IF EXISTS public.bookings 
    ADD COLUMN IF NOT EXISTS current_location_depot_id UUID REFERENCES public.depots(id);

-- Add delivered timestamp and delivered_by tracking
ALTER TABLE IF EXISTS public.bookings 
    ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

ALTER TABLE IF EXISTS public.bookings 
    ADD COLUMN IF NOT EXISTS delivered_by UUID;

-- ============================================================================
-- 2. ADD COMPLETION TIMESTAMP TO TRIPS
-- ============================================================================

ALTER TABLE IF EXISTS public.trips 
    ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- ============================================================================
-- 3. CREATE AUTO-COMPLETION TRIGGER
-- ============================================================================

-- Function to check if all bookings in a trip are delivered
CREATE OR REPLACE FUNCTION check_trip_completion()
RETURNS TRIGGER AS $$
DECLARE
    total_count INTEGER;
    delivered_count INTEGER;
    trip_id_val TEXT;
BEGIN
    -- Only proceed if status changed to 'delivered'
    IF NEW.status = 'delivered' AND (OLD.status IS NULL OR OLD.status != 'delivered') THEN
        trip_id_val := NEW.trip_id;
        
        -- Skip if not assigned to a trip
        IF trip_id_val IS NULL THEN
            RETURN NEW;
        END IF;
        
        -- Count total and delivered bookings for this trip
        SELECT 
            COUNT(*), 
            COUNT(*) FILTER (WHERE status = 'delivered')
        INTO total_count, delivered_count
        FROM public.bookings
        WHERE trip_id = trip_id_val;
        
        -- If all delivered, mark trip as completed
        IF total_count > 0 AND total_count = delivered_count THEN
            UPDATE public.trips
            SET status = 'completed', completed_at = NOW(), updated_at = NOW()
            WHERE id = trip_id_val AND status != 'completed';
            
            RAISE NOTICE 'Trip % auto-completed: all % bookings delivered', trip_id_val, total_count;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS trigger_check_trip_completion ON public.bookings;

-- Create trigger to fire after booking status update
CREATE TRIGGER trigger_check_trip_completion
    AFTER UPDATE OF status ON public.bookings
    FOR EACH ROW
    EXECUTE FUNCTION check_trip_completion();

-- ============================================================================
-- 4. CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_bookings_trip_id ON public.bookings(trip_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_current_location ON public.bookings(current_location_depot_id);

-- ============================================================================
-- 5. HELPER FUNCTION: GET TRIP DELIVERY PROGRESS
-- ============================================================================

CREATE OR REPLACE FUNCTION get_trip_delivery_progress(p_trip_id TEXT)
RETURNS TABLE(total_bookings INTEGER, delivered_bookings INTEGER, is_completed BOOLEAN) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total_bookings,
        COUNT(*) FILTER (WHERE b.status = 'delivered')::INTEGER as delivered_bookings,
        (COUNT(*) = COUNT(*) FILTER (WHERE b.status = 'delivered')) as is_completed
    FROM public.bookings b
    WHERE b.trip_id = p_trip_id;
END;
$$ LANGUAGE plpgsql;
