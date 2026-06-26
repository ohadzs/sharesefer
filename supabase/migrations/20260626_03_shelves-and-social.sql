-- PENDING — not yet applied (needs a Postgres path: seed `sharesefer-db` Keychain
-- after a DB-password reset, or run via the SQL editor). The service_role JWT does
-- NOT work for DDL/Data API on this project (403 42501), so this can't run yet.
-- Apply with:  cd ~/dev/sharesefer/tools && node db.mjs -f ../supabase/migrations/20260626_03_shelves-and-social.sql
--
-- Goodreads/IMDB-for-Hebrew layer (memory sharesefer-imdb-vision):
--   • library_entries — one row per (user, book): the user's per-book STATUS shelves
--     (own / read / want_to_buy / want_to_read / interested) + rating + review + dates.
--     Lending (the existing `listings` table) stays as-is = "own AND offered to borrow";
--     library_entries.statuses ⊇ 'own' is the broader "I have it" shelf.
--   • follows — the social graph (follow people, see their shelves).
-- Shelves are PUBLIC-readable (Goodreads-style) so the social/discovery layer works.

begin;

-- ── library_entries: per-user per-book status shelves ───────────────────
create table if not exists library_entries (
  user_id     uuid not null references profiles(id) on delete cascade,
  book_id     uuid not null references books(id)    on delete cascade,
  statuses    text[] not null default '{}',
  rating      int    check (rating between 1 and 5),
  review      text,
  finished_at date,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  primary key (user_id, book_id),
  -- statuses must be a subset of the allowed vocabulary
  constraint statuses_vocab check (
    statuses <@ array['own','read','want_to_buy','want_to_read','interested']::text[]
  )
);
create index if not exists library_entries_book_idx on library_entries (book_id);
-- GIN so "everyone who marked this book want_to_read" / "my want_to_buy shelf" stay fast
create index if not exists library_entries_status_idx on library_entries using gin (statuses);

alter table library_entries enable row level security;
create policy "shelves readable by all"  on library_entries for select using (true);
create policy "insert own shelf entry"   on library_entries for insert with check (auth.uid() = user_id);
create policy "update own shelf entry"   on library_entries for update using (auth.uid() = user_id);
create policy "delete own shelf entry"   on library_entries for delete using (auth.uid() = user_id);

-- ── follows: the social graph ───────────────────────────────────────────
create table if not exists follows (
  follower   uuid not null references profiles(id) on delete cascade,
  followee   uuid not null references profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (follower, followee),
  constraint no_self_follow check (follower <> followee)
);
create index if not exists follows_followee_idx on follows (followee);

alter table follows enable row level security;
create policy "follows readable by all" on follows for select using (true);
create policy "follow as self"          on follows for insert with check (auth.uid() = follower);
create policy "unfollow as self"        on follows for delete using (auth.uid() = follower);

-- ── grants (RLS still restricts rows) ───────────────────────────────────
grant select on public.library_entries, public.follows to anon, authenticated;
grant insert, update, delete on public.library_entries to authenticated;
grant insert, delete on public.follows to authenticated;

-- ── backfill: every existing listing means its owner OWNS that book ──────
insert into library_entries (user_id, book_id, statuses)
  select owner, book_id, array['own']::text[] from listings
on conflict (user_id, book_id) do update
  set statuses = (
    select array(select distinct unnest(library_entries.statuses || 'own'))
  ),
      updated_at = now();

commit;

-- After applying, sanity check:
--   select count(*) from library_entries;                       -- >= #listings
--   select unnest(statuses) s, count(*) from library_entries group by 1;
