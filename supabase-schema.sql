-- HCT Institute Inventory Management schema for Supabase.
-- Run this in the Supabase SQL editor before using the shared live app.
-- This schema creates no starter inventory entries.

create extension if not exists pgcrypto;

create table if not exists public.hct_inventory_items (
  id uuid primary key default gen_random_uuid(),
  item_name text not null,
  category text not null check (category in ('Equipment', 'Consumable', 'Furniture', 'Medical Supply', 'Simulation Material', 'Technology', 'Other')),
  quantity numeric not null default 0 check (quantity >= 0),
  unit_measure text not null check (unit_measure in ('Piece(s)', 'Box(es)', 'Set(s)', 'Pack(s)', 'Bottle(s)', 'Other')),
  functional_status text not null check (functional_status in ('Functional', 'Not Functional', 'Under Repair', 'Missing')),
  floor_name text not null,
  room_code text not null,
  room_name text not null,
  location_detail text,
  asset_tag text unique,
  date_added date not null default current_date,
  last_updated timestamptz not null default now(),
  remarks text,
  created_by text,
  updated_by text,
  deleted_at timestamptz,
  deleted_by text,
  created_at timestamptz not null default now()
);

create table if not exists public.hct_inventory_pieces (
  id uuid primary key default gen_random_uuid(),
  inventory_item_id uuid references public.hct_inventory_items(id) on delete cascade,
  piece_number integer not null default 1 check (piece_number > 0),
  asset_tag text not null unique,
  serial_number text,
  origin_room_code text,
  current_room_code text,
  transferred_at timestamptz,
  date_added date not null default current_date,
  functional_status text not null default 'Functional' check (functional_status in ('Functional', 'Not Functional', 'Under Repair', 'Missing')),
  remarks text,
  created_by text,
  updated_by text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hct_inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  inventory_item_id uuid references public.hct_inventory_items(id) on delete set null,
  item_name text not null,
  transaction_type text not null check (transaction_type in ('Stock In', 'Stock Out', 'Transfer', 'Return')),
  quantity numeric not null check (quantity > 0),
  unit_measure text,
  room_code text,
  source_room_code text,
  destination_room_code text,
  notes text,
  changed_by text,
  changed_role text,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now()
);

create table if not exists public.hct_vr_assets (
  id uuid primary key default gen_random_uuid(),
  inventory_item_id uuid references public.hct_inventory_items(id) on delete set null,
  inventory_piece_id uuid references public.hct_inventory_pieces(id) on delete set null,
  vr_number text not null unique,
  vr_serial_number text unique,
  brand text,
  model text,
  assigned_room_code text,
  functional_status text not null default 'Functional' check (functional_status in ('Functional', 'Not Functional', 'Under Repair', 'Missing')),
  last_maintenance_date date,
  notes text,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hct_requests (
  id uuid primary key default gen_random_uuid(),
  requester_name text not null,
  department_program text not null,
  position text not null default 'Simulationist',
  date_requested date not null default current_date,
  designation text,
  immediate_superior text,
  item_requested text not null,
  quantity_requested numeric not null check (quantity_requested > 0),
  request_items jsonb not null default '[]'::jsonb,
  reason text,
  priority_level text not null default 'Medium' check (priority_level in ('Low', 'Medium', 'High', 'Urgent')),
  status text not null default 'Pending' check (status in ('Pending', 'Approved', 'Released', 'Denied', 'Returned')),
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.hct_vr_assets
add column if not exists inventory_piece_id uuid references public.hct_inventory_pieces(id) on delete set null;

alter table public.hct_requests
add column if not exists position text not null default 'Simulationist',
add column if not exists designation text,
add column if not exists immediate_superior text,
add column if not exists request_items jsonb not null default '[]'::jsonb;

alter table public.hct_requests
alter column reason drop not null;

create table if not exists public.hct_request_history (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.hct_requests(id) on delete cascade,
  old_status text,
  new_status text,
  note text,
  changed_by text,
  changed_role text,
  created_at timestamptz not null default now()
);

create table if not exists public.hct_audit_logs (
  id uuid primary key default gen_random_uuid(),
  action_type text not null,
  record_type text not null,
  record_id text,
  old_value jsonb,
  new_value jsonb,
  changed_by text,
  changed_role text,
  created_at timestamptz not null default now()
);

create index if not exists hct_inventory_room_idx on public.hct_inventory_items(room_code);
create index if not exists hct_inventory_status_idx on public.hct_inventory_items(functional_status);
create index if not exists hct_inventory_category_idx on public.hct_inventory_items(category);
create index if not exists hct_inventory_deleted_idx on public.hct_inventory_items(deleted_at);
create index if not exists hct_pieces_item_idx on public.hct_inventory_pieces(inventory_item_id);
create index if not exists hct_pieces_room_idx on public.hct_inventory_pieces(current_room_code);
create index if not exists hct_pieces_deleted_idx on public.hct_inventory_pieces(deleted_at);
create index if not exists hct_transactions_item_idx on public.hct_inventory_transactions(inventory_item_id);
create index if not exists hct_transactions_rooms_idx on public.hct_inventory_transactions(source_room_code, destination_room_code);
create index if not exists hct_vr_search_idx on public.hct_vr_assets(vr_number, vr_serial_number, brand, model);
create index if not exists hct_requests_status_idx on public.hct_requests(status);
create index if not exists hct_audit_record_idx on public.hct_audit_logs(record_type, record_id);

create or replace function public.hct_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  if tg_table_name = 'hct_inventory_items' then
    new.last_updated = now();
  else
    new.updated_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists hct_inventory_items_updated_at on public.hct_inventory_items;
create trigger hct_inventory_items_updated_at
before update on public.hct_inventory_items
for each row execute function public.hct_set_updated_at();

drop trigger if exists hct_inventory_pieces_updated_at on public.hct_inventory_pieces;
create trigger hct_inventory_pieces_updated_at
before update on public.hct_inventory_pieces
for each row execute function public.hct_set_updated_at();

drop trigger if exists hct_vr_assets_updated_at on public.hct_vr_assets;
create trigger hct_vr_assets_updated_at
before update on public.hct_vr_assets
for each row execute function public.hct_set_updated_at();

drop trigger if exists hct_requests_updated_at on public.hct_requests;
create trigger hct_requests_updated_at
before update on public.hct_requests
for each row execute function public.hct_set_updated_at();

alter table public.hct_inventory_items enable row level security;
alter table public.hct_inventory_pieces enable row level security;
alter table public.hct_inventory_transactions enable row level security;
alter table public.hct_vr_assets enable row level security;
alter table public.hct_requests enable row level security;
alter table public.hct_request_history enable row level security;
alter table public.hct_audit_logs enable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update on table public.hct_inventory_items to anon, authenticated;
grant select, insert, update on table public.hct_inventory_pieces to anon, authenticated;
grant select, insert, update on table public.hct_inventory_transactions to anon, authenticated;
grant select, insert, update on table public.hct_vr_assets to anon, authenticated;
grant select, insert, update on table public.hct_requests to anon, authenticated;
grant select, insert, update on table public.hct_request_history to anon, authenticated;
grant select, insert on table public.hct_audit_logs to anon, authenticated;

drop policy if exists "Public can read inventory" on public.hct_inventory_items;
create policy "Public can read inventory"
on public.hct_inventory_items
for select
to anon, authenticated
using (true);

drop policy if exists "Public can add inventory" on public.hct_inventory_items;
create policy "Public can add inventory"
on public.hct_inventory_items
for insert
to anon, authenticated
with check (true);

drop policy if exists "Public can update inventory" on public.hct_inventory_items;
create policy "Public can update inventory"
on public.hct_inventory_items
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "Public can read inventory pieces" on public.hct_inventory_pieces;
create policy "Public can read inventory pieces"
on public.hct_inventory_pieces
for select
to anon, authenticated
using (true);

drop policy if exists "Public can add inventory pieces" on public.hct_inventory_pieces;
create policy "Public can add inventory pieces"
on public.hct_inventory_pieces
for insert
to anon, authenticated
with check (true);

drop policy if exists "Public can update inventory pieces" on public.hct_inventory_pieces;
create policy "Public can update inventory pieces"
on public.hct_inventory_pieces
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "Public can read transactions" on public.hct_inventory_transactions;
create policy "Public can read transactions"
on public.hct_inventory_transactions
for select
to anon, authenticated
using (true);

drop policy if exists "Public can add transactions" on public.hct_inventory_transactions;
create policy "Public can add transactions"
on public.hct_inventory_transactions
for insert
to anon, authenticated
with check (true);

drop policy if exists "Public can update transactions" on public.hct_inventory_transactions;
create policy "Public can update transactions"
on public.hct_inventory_transactions
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "Public can read VR assets" on public.hct_vr_assets;
create policy "Public can read VR assets"
on public.hct_vr_assets
for select
to anon, authenticated
using (true);

drop policy if exists "Public can add VR assets" on public.hct_vr_assets;
create policy "Public can add VR assets"
on public.hct_vr_assets
for insert
to anon, authenticated
with check (true);

drop policy if exists "Public can update VR assets" on public.hct_vr_assets;
create policy "Public can update VR assets"
on public.hct_vr_assets
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "Public can read requests" on public.hct_requests;
create policy "Public can read requests"
on public.hct_requests
for select
to anon, authenticated
using (true);

drop policy if exists "Public can add requests" on public.hct_requests;
create policy "Public can add requests"
on public.hct_requests
for insert
to anon, authenticated
with check (true);

drop policy if exists "Public can update requests" on public.hct_requests;
create policy "Public can update requests"
on public.hct_requests
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "Public can read request history" on public.hct_request_history;
create policy "Public can read request history"
on public.hct_request_history
for select
to anon, authenticated
using (true);

drop policy if exists "Public can add request history" on public.hct_request_history;
create policy "Public can add request history"
on public.hct_request_history
for insert
to anon, authenticated
with check (true);

drop policy if exists "Public can read audit logs" on public.hct_audit_logs;
create policy "Public can read audit logs"
on public.hct_audit_logs
for select
to anon, authenticated
using (true);

drop policy if exists "Public can add audit logs" on public.hct_audit_logs;
create policy "Public can add audit logs"
on public.hct_audit_logs
for insert
to anon, authenticated
with check (true);

do $$
declare
  table_name text;
  tracked_tables text[] := array[
    'hct_inventory_items',
    'hct_inventory_pieces',
    'hct_inventory_transactions',
    'hct_vr_assets',
    'hct_requests',
    'hct_request_history',
    'hct_audit_logs'
  ];
begin
  foreach table_name in array tracked_tables loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end $$;
