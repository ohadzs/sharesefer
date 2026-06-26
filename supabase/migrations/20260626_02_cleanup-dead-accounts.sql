-- NOT YET APPLIED — pending Ohad's go-ahead. This DELETEs data, so Ohad runs it
-- himself:  cd ~/dev/sharesefer/tools && node db.mjs -f ../supabase/migrations/20260626_02_cleanup-dead-accounts.sql
--
-- Removes the two now-dead auth users left over after migration 01:
--   75bccbd4-4d84-458d-9e72-9d80fa02d728  ohadzs100@gmail.com  (no dot) — emptied by migration 01
--   a36541b9-0ce7-4568-b17a-fa1b65652df5  daniel.demo@sharesefer.dev   — demo account, 1 demo listing
--
-- Cascade effects (see schema.sql):
--   • profiles.id      → auth.users ON DELETE CASCADE  → their profile rows go too
--   • listings.owner   → profiles   ON DELETE CASCADE  → daniel's demo listing goes too
--   • books.created_by → auth.users ON DELETE SET NULL → catalog books survive (creator nulled)
--
-- VERIFY FIRST (expect old account = 0/0; real account e4b9… still 55/54):
--   select u.id, u.email, count(l.*) as listings
--     from auth.users u left join listings l on l.owner = u.id group by 1,2 order by 3 desc;

begin;
delete from auth.users where id in (
  '75bccbd4-4d84-458d-9e72-9d80fa02d728',  -- old no-dot ohadzs100
  'a36541b9-0ce7-4568-b17a-fa1b65652df5'   -- daniel.demo
);
commit;

-- OPTIONAL, run separately if you want a tidy catalog: prune books that are now
-- orphaned (no listing points at them — e.g. daniel's demo title). Review the
-- SELECT before deleting; books are a shared catalog so don't delete blindly.
--   select id, title, author from books b
--     where not exists (select 1 from listings l where l.book_id = b.id);
