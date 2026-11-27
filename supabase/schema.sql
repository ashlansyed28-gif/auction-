-- Optional Supabase schema for persistent T20 Auction rooms & scorecards
-- Run in Supabase Dashboard -> SQL Editor

create table if not exists public.auction_rooms (
  room_code text primary key,
  host_client_id text not null,
  status text not null default 'LOBBY',
  snapshot jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.auction_rooms enable row level security;

create policy "Allow anonymous room read"
  on public.auction_rooms for select
  using (true);

create policy "Allow anonymous room insert"
  on public.auction_rooms for insert
  with check (true);

create policy "Allow anonymous room update"
  on public.auction_rooms for update
  using (true);

-- Enable Realtime replication if querying table changes in addition to Broadcast:
-- alter publication supabase_realtime add table public.auction_rooms;
