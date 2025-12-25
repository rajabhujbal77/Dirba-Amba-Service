-- Fix trigger function: receiver_packages has receiver_id, not booking_id
-- The trigger needs to get booking_id through the booking_receivers table

-- Drop the old trigger first
DROP TRIGGER IF EXISTS trigger_update_booking_subtotal ON public.receiver_packages;

-- Recreate the function with correct column reference
CREATE OR REPLACE FUNCTION update_booking_subtotal()
RETURNS TRIGGER AS $$
DECLARE
    v_booking_id TEXT;
BEGIN
    -- Get the booking_id from the booking_receivers table using receiver_id
    IF TG_OP = 'DELETE' THEN
        SELECT br.booking_id INTO v_booking_id
        FROM public.booking_receivers br
        WHERE br.id = OLD.receiver_id;
    ELSE
        SELECT br.booking_id INTO v_booking_id
        FROM public.booking_receivers br
        WHERE br.id = NEW.receiver_id;
    END IF;
    
    -- Update the booking totals
    IF v_booking_id IS NOT NULL THEN
        UPDATE public.bookings
        SET subtotal = calculate_booking_total(v_booking_id),
            total_amount = calculate_booking_total(v_booking_id)
        WHERE id = v_booking_id;
    END IF;
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
CREATE TRIGGER trigger_update_booking_subtotal
    AFTER INSERT OR UPDATE OR DELETE ON public.receiver_packages
    FOR EACH ROW
    EXECUTE FUNCTION update_booking_subtotal();
