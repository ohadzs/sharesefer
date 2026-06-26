-- APPLIED 2026-06-26 (via Supabase SQL editor; verified 55 books / 54 listings moved).
-- Re-point Ohad's seeded data from the no-dot account to his real Google login.
--   OLD  75bccbd4-4d84-458d-9e72-9d80fa02d728  ohadzs100@gmail.com  (no dot, seed target)
--   REAL e4b9e9a2-c9e2-4839-8cfb-3bb23929b5c3  ohad.zs100@gmail.com (dot, Google one-click login)
-- Gmail ignores dots; Supabase does not normalize them, so the seed landed on the wrong user.

begin;
insert into profiles (id, name, city, whatsapp)
  select 'e4b9e9a2-c9e2-4839-8cfb-3bb23929b5c3', name, city, whatsapp
  from profiles where id = '75bccbd4-4d84-458d-9e72-9d80fa02d728'
  on conflict (id) do update set
    name=coalesce(profiles.name,excluded.name), city=coalesce(profiles.city,excluded.city),
    whatsapp=coalesce(profiles.whatsapp,excluded.whatsapp);
update books    set created_by='e4b9e9a2-c9e2-4839-8cfb-3bb23929b5c3' where created_by='75bccbd4-4d84-458d-9e72-9d80fa02d728';
update listings set owner     ='e4b9e9a2-c9e2-4839-8cfb-3bb23929b5c3' where owner     ='75bccbd4-4d84-458d-9e72-9d80fa02d728';
commit;
