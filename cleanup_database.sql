-- DATABASE CLEANUP SCRIPT
-- This script removes ALL data except for one admin user (gouravdixit85@gmail.com)
-- Run this in Supabase SQL Editor

-- =============================================================================
-- WARNING: This will DELETE ALL DATA. Please backup before running!
-- =============================================================================

-- ============ 1. DELETE TRANSACTIONAL DATA (CHILD TABLES FIRST) ============

-- Delete receiver packages (child of booking_receivers)
DELETE FROM public.receiver_packages WHERE true;

-- Delete booking receivers (child of bookings)
DELETE FROM public.booking_receivers WHERE true;

-- Delete trip_bookings junction table
DELETE FROM public.trip_bookings WHERE true;

-- Delete ledger transactions
DELETE FROM public.ledger_transactions WHERE true;

-- Delete credit payments (if exists)
DO $$ BEGIN
  DELETE FROM public.credit_payments WHERE true;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- Delete credit customer pricing (if exists)
DO $$ BEGIN
  DELETE FROM public.credit_customer_pricing WHERE true;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- Delete credit customers (if exists)
DO $$ BEGIN
  DELETE FROM public.credit_customers WHERE true;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- Delete contacts (if exists)
DO $$ BEGIN
  DELETE FROM public.contacts WHERE true;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- Delete bookings
DELETE FROM public.bookings WHERE true;

-- Delete trips
DELETE FROM public.trips WHERE true;

-- ============ 2. DELETE CONFIGURATION DATA ============

-- Delete depot routes
DELETE FROM public.depot_routes WHERE true;

-- Delete depot pricing (if exists)
DO $$ BEGIN
  DELETE FROM public.depot_pricing WHERE true;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- Delete depot_package_prices (if exists) - must be before packages
DO $$ BEGIN
  DELETE FROM public.depot_package_prices WHERE true;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- Delete packages (pricing sizes)
DELETE FROM public.packages WHERE true;

-- Delete season settings
DELETE FROM public.season_settings WHERE true;

-- Clear depot references from profiles BEFORE deleting depots
UPDATE public.profiles SET assigned_depot_id = NULL WHERE assigned_depot_id IS NOT NULL;

-- Delete depots
DELETE FROM public.depots WHERE true;

-- ============ 3. DELETE USERS EXCEPT ADMIN ============

-- Delete all profiles EXCEPT gouravdixit85@gmail.com
DELETE FROM public.profiles 
WHERE email != 'gouravdixit85@gmail.com';

-- Update the admin user to be owner role (in case it's not)
UPDATE public.profiles 
SET 
    role = 'owner',
    assigned_depot_id = NULL  -- Clear depot assignment since depots are deleted
WHERE email = 'gouravdixit85@gmail.com';

-- ============ 4. RESET SEQUENCES / COUNTERS ============

-- Reset receipt counter with correct column names
UPDATE public.receipt_counter 
SET 
  counter = 0,
  payment_counter = 0,
  trip_counter = 0,
  last_date = NULL,
  payment_last_date = NULL,
  trip_last_date = NULL
WHERE id = 1;

-- ============ DONE ============
SELECT 'Database cleaned successfully! Only admin user gouravdixit85@gmail.com remains.' as result;
