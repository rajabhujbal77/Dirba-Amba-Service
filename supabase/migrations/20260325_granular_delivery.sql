-- Migration: Granular Delivery Control
-- Created: 2026-03-25
-- Description: Enables per-receiver delivery tracking instead of whole-booking delivery.
--   Each receiver in a booking can be independently marked as delivered.

-- ============================================================================
-- 1. ADD STATUS COLUMNS TO BOOKING_RECEIVERS
-- ============================================================================

-- Receiver-level delivery status
ALTER TABLE booking_receivers ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'in_transit';

-- Timestamp when this specific receiver was marked delivered
ALTER TABLE booking_receivers ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

-- Per-receiver to_pay collection tracking
ALTER TABLE booking_receivers ADD COLUMN IF NOT EXISTS to_pay_collected_method TEXT;
ALTER TABLE booking_receivers ADD COLUMN IF NOT EXISTS to_pay_collected_at TIMESTAMPTZ;

-- Add comments for documentation
COMMENT ON COLUMN booking_receivers.status IS 'Delivery status per receiver: in_transit, delivered';
COMMENT ON COLUMN booking_receivers.delivered_at IS 'Timestamp when this receiver delivery was completed';
COMMENT ON COLUMN booking_receivers.to_pay_collected_method IS 'Payment method used to collect to_pay amount for this receiver (cash, online)';
COMMENT ON COLUMN booking_receivers.to_pay_collected_at IS 'Timestamp when to_pay was collected for this receiver';

-- ============================================================================
-- 2. ADD 'partially_delivered' TO BOOKING STATUS ENUM
-- ============================================================================

-- The booking_status enum is used on bookings.status
-- We need to add 'partially_delivered' between existing values
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'partially_delivered';

-- ============================================================================
-- 3. RECREATE bookings_complete VIEW WITH RECEIVER STATUS FIELDS
-- ============================================================================

DROP VIEW IF EXISTS bookings_complete;
CREATE OR REPLACE VIEW bookings_complete AS
SELECT 
  b.*,
  od.name as origin_depot_name,
  dd.name as destination_depot_name,
  COALESCE(
    (SELECT jsonb_agg(
      jsonb_build_object(
        'id', br.id,
        'name', br.receiver_name,
        'phone', br.receiver_phone,
        'address', br.delivery_address,
        'status', br.status,
        'delivered_at', br.delivered_at,
        'to_pay_collected_method', br.to_pay_collected_method,
        'to_pay_collected_at', br.to_pay_collected_at,
        'packages', (
          SELECT COALESCE(jsonb_agg(
            jsonb_build_object(
              'id', rp.id,
              'package_id', rp.package_id,
              'size', rp.package_size,
              'quantity', rp.quantity,
              'price_per_unit', rp.price_per_unit,
              'total_price', rp.quantity * rp.price_per_unit,
              'description', rp.description
            )
          ), '[]'::jsonb)
          FROM receiver_packages rp
          WHERE rp.receiver_id = br.id
        )
      ) ORDER BY br.receiver_order
    )
    FROM booking_receivers br
    WHERE br.booking_id = b.id
  ), '[]'::jsonb) as receivers
FROM bookings b
LEFT JOIN depots od ON b.origin_depot_id = od.id
LEFT JOIN depots dd ON b.destination_depot_id = dd.id;

-- Grant access
GRANT SELECT ON bookings_complete TO authenticated;
GRANT SELECT ON bookings_complete TO anon;

-- ============================================================================
-- 4. INDEX FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_booking_receivers_status ON booking_receivers(status);
