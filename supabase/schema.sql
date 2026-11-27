-- Supabase schema for T20 Auction Email Auth profiles & persistent rooms
-- Run in Supabase Dashboard -> SQL Editor

create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  username text unique not null check (username ~ '^[A-Za-z0-9_]{3,16}$'),
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Public profiles are readable" on public.profiles;
create policy "Public profiles are readable"
  on public.profiles for select
  using (true);

drop policy if exists "Users insert own profile" on public.profiles;
create policy "Users insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create table if not exists public.auction_rooms (
  room_code text primary key,
  host_client_id text not null,
  status text not null default 'LOBBY',
  snapshot jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.auction_rooms enable row level security;

drop policy if exists "Allow anonymous room read" on public.auction_rooms;
create policy "Allow anonymous room read"
  on public.auction_rooms for select
  using (true);

drop policy if exists "Allow anonymous room insert" on public.auction_rooms;
create policy "Allow anonymous room insert"
  on public.auction_rooms for insert
  with check (true);

drop policy if exists "Allow anonymous room update" on public.auction_rooms;
create policy "Allow anonymous room update"
  on public.auction_rooms for update
  using (true);

-- Enable Realtime replication if querying table changes in addition to Broadcast:
-- alter publication supabase_realtime add table public.auction_rooms;
