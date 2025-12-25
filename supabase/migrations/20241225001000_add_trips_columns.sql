-- Migration: Add missing columns to trips table
-- Created: 2024-12-25
-- Description: Adds driver_phone, trip_cost and other missing columns

-- Add missing columns to trips table
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS driver_phone TEXT;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS trip_cost DECIMAL(10,2) DEFAULT 0;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS trip_type TEXT DEFAULT 'origin';
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS expected_delivery_date DATE;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Ensure trip_number column exists
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS trip_number TEXT;

-- Add unique constraint if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'trips_trip_number_key') THEN
        ALTER TABLE public.trips ADD CONSTRAINT trips_trip_number_key UNIQUE (trip_number);
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;
