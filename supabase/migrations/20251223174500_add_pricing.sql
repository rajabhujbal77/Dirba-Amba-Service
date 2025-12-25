create table public.depot_package_prices (
    id uuid primary key default gen_random_uuid(),
    depot_id uuid references public.depots(id) not null,
    package_id uuid references public.packages(id) not null,
    price decimal(10,2) not null,
    created_at timestamp with time zone default now(),
    unique(depot_id, package_id)
);

alter table public.depot_package_prices enable row level security;
create policy "Allow all access" on public.depot_package_prices for all using (true);
