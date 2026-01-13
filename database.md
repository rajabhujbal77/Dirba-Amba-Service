# Database Schema Documentation

> **Last Updated:** January 13, 2026  
> **Database:** Supabase PostgreSQL

---

## Table of Contents

1. [Tables Overview](#tables-overview)
2. [Table Relationships](#table-relationships)
3. [Enums](#enums)
4. [Triggers](#triggers)
5. [RLS Policies](#rls-policies)
6. [Views](#views)
7. [Cleanup Scripts](#cleanup-scripts)

---

## Tables Overview

### Configuration Tables (KEEP on cleanup)

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `depots` | Depot locations | id, name, type, location, contact_person, contact_phone |
| `profiles` | Users/Staff | id, email, password, full_name, role, assigned_depot_id |
| `packages` | Package sizes | id, name, base_price, sort_order |
| `depot_routes` | Forwarding routes | origin_depot_id, forwarding_depot_id |
| `depot_pricing` | Price per package per depot | package_id, depot_id, price |
| `depot_package_prices` | Alias for depot pricing | package_id, depot_id, price |
| `season_settings` | Season dates | start_date, end_date, is_active |
| `contacts` | Customer contacts (autocomplete) | name, phone |

### Transactional Tables (DELETE on cleanup)

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `bookings` | Main booking records | id, receipt_number, sender_name, sender_phone, payment_method |
| `booking_receivers` | Receiver info per booking | booking_id, receiver_name, receiver_phone |
| `receiver_packages` | Packages per receiver | receiver_id, package_id, quantity, price |
| `trips` | Vehicle trips | id, trip_number, driver_name, vehicle_number |
| `trip_bookings` | Junction: bookings ↔ trips | trip_id, booking_id |
| `credit_payments` | Advance payments from credit customers | customer_phone, amount, payment_method |
| `ledger_transactions` | Credit/debit transactions | customer_name, type, amount, booking_id |

### Customer Pricing Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `credit_customers` | Customer display names | phone, display_name, notes |
| `credit_customer_pricing` | Custom prices per customer | customer_phone, package_id, depot_id, discounted_price |

### System Tables

| Table | Purpose |
|-------|---------|
| `receipt_counter` | Counter for receipt numbers |
| `kv_store_*` | Key-value store for realtime |

---

## Table Relationships

```
depots
  ├── profiles (assigned_depot_id)
  ├── depot_routes (origin_depot_id, forwarding_depot_id)
  ├── depot_pricing (depot_id)
  └── bookings (origin_depot_id, destination_depot_id)

packages
  ├── depot_pricing (package_id)
  ├── receiver_packages (package_id)
  └── credit_customer_pricing (package_id)

bookings
  ├── booking_receivers (booking_id)
  ├── trip_bookings (booking_id)
  └── ledger_transactions (booking_id)

booking_receivers
  └── receiver_packages (receiver_id)

trips
  └── trip_bookings (trip_id)
```

---

## Enums

| Enum | Values |
|------|--------|
| `user_role` | owner, booking_clerk, depot_manager |
| `depot_type` | origin, managed, direct_pickup |
| `booking_status` | booked, loading, in_transit, reached_depot, out_for_delivery, delivered |
| `trip_status` | planned, loading, in_transit, completed, cancelled |
| `payment_mode` | cash, upi, bank_transfer, credit |

---

## Triggers

| Trigger | Table | Timing | Event | Purpose |
|---------|-------|--------|-------|---------|
| `trigger_generate_receipt_number` | bookings | BEFORE | INSERT | Auto-generates receipt number (DRT-DDMM-XXXX) |
| `update_bookings_version_trigger` | bookings | BEFORE | UPDATE | Tracks version for offline sync |
| `trigger_check_trip_completion` | bookings | AFTER | UPDATE | Updates trip status when bookings change |
| `trigger_generate_payment_receipt` | credit_payments | BEFORE | INSERT | Auto-generates payment receipt number |
| `trigger_update_booking_subtotal` | receiver_packages | AFTER | INSERT/UPDATE/DELETE | Recalculates booking subtotal |
| `trips_auto_number` | trips | BEFORE | INSERT | Auto-generates trip number (TRP-DDMM-XXX) |
| `update_trips_version_trigger` | trips | BEFORE | UPDATE | Tracks version for offline sync |

---

## Functions

| Function | Purpose |
|----------|---------|
| `get_next_receipt_number` | Generates atomic receipt number |
| `generate_receipt_number_for_booking` | Wrapper for receipt generation |
| `generate_payment_receipt_number` | Generates payment receipt number |
| `get_next_trip_number` | Generates atomic trip number |
| `set_trip_number` | Sets trip number on insert |
| `update_booking_subtotal` | Recalculates booking totals |
| `calculate_booking_total` | Calculates total from packages |
| `create_booking_atomic` | Creates booking atomically (offline support) |
| `update_booking_version` | Increments version for sync |
| `update_trip_version` | Increments trip version for sync |
| `check_trip_completion` | Checks if all bookings delivered |
| `get_trip_delivery_progress` | Gets delivery progress % |
| `upsert_contact` | Inserts or updates contact |

---

## RLS Policies

All tables have RLS enabled with "Allow all access" policies for prototype mode.

---

## Views

| View | Purpose |
|------|---------|
| `bookings_complete` | Joins bookings with depot names, receivers, and packages |

---

## Current Record Counts (as of Jan 13, 2026)

| Table | Count |
|-------|-------|
| depots | 82 |
| packages | 7 |
| profiles | 3 |
| contacts | 25 |
| bookings | 0 |
| trips | 0 |

---

## Cleanup Scripts

### Fresh Start (Keep Config, Delete Data)
```sql
-- Deletes: bookings, trips, payments, ledger
-- Keeps: depots, packages, pricing, users, contacts
-- See: cleanup scripts below
```

### Delete Transactional Data Only
```sql
DELETE FROM public.receiver_packages WHERE true;
DELETE FROM public.booking_receivers WHERE true;
DELETE FROM public.trip_bookings WHERE true;
DELETE FROM public.ledger_transactions WHERE true;
DELETE FROM public.credit_payments WHERE true;
DELETE FROM public.credit_customer_pricing WHERE true;
DELETE FROM public.bookings WHERE true;
DELETE FROM public.trips WHERE true;

UPDATE public.receipt_counter 
SET counter = 0, payment_counter = 0, trip_counter = 0,
    last_date = CURRENT_DATE, payment_last_date = CURRENT_DATE, trip_last_date = CURRENT_DATE
WHERE id = 1;
```

### Full Database Reset
See `cleanup_database.sql` in project root.

---

## Migration History

| Date | Migration | Purpose |
|------|-----------|---------|
| 2024-12-23 | remote_schema | Initial schema |
| 2024-12-23 | create_drt_schema | Core tables (depots, profiles, bookings, trips) |
| 2024-12-23 | add_pricing | Depot pricing tables |
| 2024-12-24 | update_bookings_normalized | Normalized booking structure |
| 2024-12-24 | fix_trigger | Subtotal calculation trigger |
| 2024-12-24 | receipt_counter | Receipt counter table |
| 2024-12-24 | atomic_receipt_number | Atomic receipt generation |
| 2024-12-24 | credit_payments | Credit payments table |
| 2024-12-24 | create_contacts | Contacts table |
| 2024-12-25 | create_trips_table | Trips and trip_bookings |
| 2024-12-25 | add_trips_columns | Additional trip columns |
| 2024-12-25 | fix_trip_number_format | Trip number format |
| 2024-12-25 | trip_receipt_integration | Trip-booking integration |
| 2024-12-25 | add_test_booking_clerk | Test user |
| 2024-12-25 | add_test_depot_managers | Test depot managers |
| 2025-12-26 | create_booking_atomic | Atomic booking with offline sync |
| 2025-12-28 | add_to_pay_columns | To-pay delivery columns |
| 2025-12-28 | credit_customer_pricing | Customer-specific pricing |

---

## Important Notes

1. **Foreign Key Order**: When deleting data, always delete child tables first
2. **Receipt Counter**: Has NOT NULL constraints on date columns - use CURRENT_DATE, not NULL
3. **Customer Pricing**: Works for ALL payment methods, not just credit
4. **RLS**: Currently permissive for prototype - tighten for production
