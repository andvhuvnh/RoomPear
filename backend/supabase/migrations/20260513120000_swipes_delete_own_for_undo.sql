-- Discover undo: swiper may delete their own row so daily swipe count matches server state.
drop policy if exists "users can delete own swipes" on public.swipes;
create policy "users can delete own swipes"
  on public.swipes for delete
  using (auth.uid() = swiper_id);
