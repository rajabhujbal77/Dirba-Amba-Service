-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. ENUMS
create type user_role as enum ('owner', 'booking_clerk', 'depot_manager');
create type depot_type as enum ('origin', 'managed', 'direct_pickup');
create type booking_status as enum ('booked', 'loading', 'in_transit', 'reached_depot', 'out_for_delivery', 'delivered');
create type trip_status as enum ('planned', 'loading', 'in_transit', 'completed', 'cancelled');
create type payment_mode as enum ('cash', 'upi', 'bank_transfer', 'credit');

-- 2. TABLES

-- Depots
create table public.depots (
    id uuid primary key default gen_random_uuid(),
    number serial,
    name text not null,
    type depot_type not null,
    location text,
    contact_person text,
    contact_phone text,
    created_at timestamp with time zone default now()
);

-- Profiles (Users)
-- Note: Ideally this links to auth.users, but for now we'll keep it simple and allow manual management matching current app
create table public.profiles (
    id uuid primary key default gen_random_uuid(),
    -- In a real app, this should reference auth.users(id)
    -- user_id uuid references auth.users(id), 
    email text unique not null,
    password text, -- Storing plainly for now as per current app logic (warning: insecure, for prototype mainly)
    full_name text not null,
    role user_role not null default 'booking_clerk',
    assigned_depot_id uuid references public.depots(id),
    status text default 'active',
    created_at timestamp with time zone default now()
);

-- Packages (Pricing Settings)
create table public.packages (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    base_price decimal(10,2) not null default 0,
    created_at timestamp with time zone default now()
);

-- Depot Routes (Forwarding Logic)
create table public.depot_routes (
    id uuid primary key default gen_random_uuid(),
    origin_depot_id uuid references public.depots(id) not null,
    forwarding_depot_id uuid references public.depots(id) not null,
    created_at timestamp with time zone default now(),
    unique(origin_depot_id, forwarding_depot_id)
);

-- Season Settings
create table public.season_settings (
    id uuid primary key default gen_random_uuid(),
    start_date date,
    end_date date,
    is_active boolean default true,
    updated_at timestamp with time zone default now()
);

-- Trips
create table public.trips (
    id text primary key, -- user generated ID like "TR-101"
    origin_depot_id uuid references public.depots(id),
    destination_depot_id uuid references public.depots(id),  -- Can be null for multi-drop
    driver_name text,
    vehicle_number text,
    departure_time timestamp with time zone,
    arrival_time timestamp with time zone,
    status trip_status default 'planned',
    total_weight text, -- e.g. "2400 kg"
    created_by uuid references public.profiles(id),
    created_at timestamp with time zone default now()
);

-- Bookings
create table public.bookings (
    id text primary key, -- user generated like "BK-1001"
    customer_name text not null,
    customer_phone text not null,
    customer_email text,
    
    origin_location text, -- Text for now, or link to depot if strict
    destination_location text,
    
    quantity text, -- e.g. "500"
    mango_variety text,
    pickup_date date,
    
    rate_per_kg decimal(10,2),
    total_amount decimal(10,2),
    advance_payment decimal(10,2),
    
    payment_mode payment_mode default 'cash',
    special_instructions text,
    
    status booking_status default 'booked',
    trip_id text references public.trips(id), -- Nullable until assigned
    
    created_by uuid references public.profiles(id),
    created_at timestamp with time zone default now()
);

-- Credit Ledger Transactions
create table public.ledger_transactions (
    id uuid primary key default gen_random_uuid(),
    customer_name text not null, -- Or link to a Customers table if strict
    date timestamp with time zone default now(),
    description text,
    type text check (type in ('credit', 'debit')),
    amount decimal(10,2) not null,
    booking_id text references public.bookings(id),
    created_by uuid references public.profiles(id)
);

-- 3. RLS POLICIES (Basic for now)
alter table public.depots enable row level security;
alter table public.profiles enable row level security;
alter table public.packages enable row level security;
alter table public.bookings enable row level security;
alter table public.trips enable row level security;

-- Allow everything for anon temporarily to match current auth state
-- (Since we aren't using real Supabase Auth tokens in the simple prototype frontend yet)
create policy "Allow all access" on public.depots for all using (true);
create policy "Allow all access" on public.profiles for all using (true);
create policy "Allow all access" on public.packages for all using (true);
create policy "Allow all access" on public.bookings for all using (true);
create policy "Allow all access" on public.trips for all using (true);
create policy "Allow all access" on public.depot_routes for all using (true);
create policy "Allow all access" on public.season_settings for all using (true);
create policy "Allow all access" on public.ledger_transactions for all using (true);

-- 4. Initial Data (Optional - Create Default Admin)
insert into public.profiles (email, password, full_name, role)
values ('admin@mango.com', 'admin123', 'System Admin', 'owner');
