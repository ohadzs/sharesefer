-- ShareSefer database schema (run once in Supabase → SQL Editor)
-- Tables: profiles · books (shared catalog) · listings (a user's copy of a book)

-- ── profiles ────────────────────────────────────────────────────────────
create table if not exists profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  name       text,
  city       text,
  whatsapp   text,                       -- intl format, digits only: 972501234567
  created_at timestamptz default now()
);
alter table profiles enable row level security;
create policy "profiles readable by all" on profiles for select using (true);
create policy "insert own profile"       on profiles for insert with check (auth.uid() = id);
create policy "update own profile"       on profiles for update using (auth.uid() = id);

-- ── books (shared catalog, deduplicated across users) ───────────────────
create table if not exists books (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  author     text,
  year       int,
  publisher  text,
  language   text default 'עברית',
  tags       text[],
  photo_url  text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);
alter table books enable row level security;
create policy "books readable by all"   on books for select using (true);
create policy "authed can add books"    on books for insert with check (auth.uid() is not null);
create policy "creator can edit book"   on books for update using (auth.uid() = created_by);

-- ── listings (links a book in the catalog to the user who lends it) ──────
create table if not exists listings (
  id         uuid primary key default gen_random_uuid(),
  book_id    uuid not null references books(id) on delete cascade,
  owner      uuid not null references profiles(id) on delete cascade,
  available  boolean default true,
  created_at timestamptz default now(),
  unique (book_id, owner)
);
alter table listings enable row level security;
create policy "listings readable by all" on listings for select using (true);
create policy "add own listing"          on listings for insert with check (auth.uid() = owner);
create policy "update own listing"       on listings for update using (auth.uid() = owner);
create policy "delete own listing"       on listings for delete using (auth.uid() = owner);

-- ── storage: book cover photos ──────────────────────────────────────────
insert into storage.buckets (id, name, public)
  values ('book-photos', 'book-photos', true)
  on conflict (id) do nothing;
create policy "book photos public read" on storage.objects
  for select using (bucket_id = 'book-photos');
create policy "authed upload book photos" on storage.objects
  for insert with check (bucket_id = 'book-photos' and auth.uid() is not null);

-- ── grants: expose tables to the Data API roles (RLS still restricts rows) ──
grant usage on schema public to anon, authenticated;
grant select on public.books, public.listings, public.profiles to anon, authenticated;
grant insert, update on public.books to authenticated;
grant insert, update, delete on public.listings to authenticated;
grant insert, update on public.profiles to authenticated;
