-- Migration: Add to_pay collection tracking columns to bookings table
-- Created: 2025-12-28
-- Description: Adds columns to track when and how "To Pay" bookings were collected upon delivery

-- Add columns for tracking to_pay collection
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS to_pay_collected_method TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS to_pay_collected_at TIMESTAMPTZ;

-- Add comment for documentation
COMMENT ON COLUMN bookings.to_pay_collected_method IS 'Payment method used to collect to_pay amount (cash, online)';
COMMENT ON COLUMN bookings.to_pay_collected_at IS 'Timestamp when to_pay amount was collected';

-- Update the bookings_complete view to include new columns
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
