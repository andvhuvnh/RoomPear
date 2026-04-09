-- Create swipes table to record like/pass decisions between users
create table if not exists public.swipes (
  id          uuid        default gen_random_uuid() primary key,
  swiper_id   uuid        not null references public.profiles(id) on delete cascade,
  swiped_id   uuid        not null references public.profiles(id) on delete cascade,
  direction   text        not null check (direction in ('like', 'pass')),
  created_at  timestamptz not null default now(),
  constraint swipes_unique_pair unique (swiper_id, swiped_id)
);

alter table public.swipes enable row level security;

-- Users can record their own swipes
create policy "users can insert own swipes"
  on public.swipes for insert
  with check (auth.uid() = swiper_id);

-- Users can read swipes where they are swiper or target (needed for match detection)
create policy "users can view relevant swipes"
  on public.swipes for select
  using (auth.uid() = swiper_id or auth.uid() = swiped_id);

-- Indexes for fast lookups at scale
create index on public.swipes (swiper_id);
create index on public.swipes (swiped_id);
-- Partial index: only index likes for fast match detection
create index on public.swipes (swiped_id, swiper_id) where direction = 'like';
