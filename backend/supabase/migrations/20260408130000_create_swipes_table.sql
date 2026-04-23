-- Create swipes table to record like/pass decisions between users.
-- Timestamp is after messaging migrations so `supabase db push` stays linear when those were applied first.

create table if not exists public.swipes (
  id          uuid        default gen_random_uuid() primary key,
  swiper_id   uuid        not null references public.profiles(id) on delete cascade,
  swiped_id   uuid        not null references public.profiles(id) on delete cascade,
  direction   text        not null check (direction in ('like', 'pass')),
  created_at  timestamptz not null default now(),
  constraint swipes_unique_pair unique (swiper_id, swiped_id)
);

alter table public.swipes enable row level security;

drop policy if exists "users can insert own swipes" on public.swipes;
create policy "users can insert own swipes"
  on public.swipes for insert
  with check (auth.uid() = swiper_id);

drop policy if exists "users can view relevant swipes" on public.swipes;
create policy "users can view relevant swipes"
  on public.swipes for select
  using (auth.uid() = swiper_id or auth.uid() = swiped_id);

create index if not exists swipes_swiper_id_idx on public.swipes (swiper_id);
create index if not exists swipes_swiped_id_idx on public.swipes (swiped_id);
create index if not exists swipes_mutual_likes_idx
  on public.swipes (swiped_id, swiper_id) where direction = 'like';
