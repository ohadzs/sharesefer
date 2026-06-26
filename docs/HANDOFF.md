# ShareSefer — session handoff (2026-06-26)

Paste the block below as the first message in a clean session.

---

ShareSefer / sifriya — continuation. Hub `~/Desktop/ohad`, code `~/dev/sharesefer`
(static frontend + Supabase, deploy `npx wrangler pages deploy . --project-name=sharesefer`).

**HARD RULE: do not use my screen / browser / computer-use. All DB work goes through the new CLI.**

## DB CLI (new, `~/dev/sharesefer/tools/`)
Run SQL without the dashboard: `cd ~/dev/sharesefer/tools && node db.mjs -c "select …"` (also `-f file.sql`, stdin).
Connection string comes from `$DATABASE_URL` or macOS Keychain item `sharesefer-db`.
- **First task:** `npm install` in `tools/`, then check the Keychain is seeded
  (`node db.mjs -c "select 1;"`). If it fails, ask Ohad to seed it once (instructions in
  `tools/README.md`; he grabs the URI from Supabase → Settings → Database → Connection string).
  Don't seed it yourself — it needs the DB password, which only Ohad has.
- ✅ **Seeded 2026-06-26.** `sharesefer-db` Keychain item now holds the pooler URI (Ohad reset
  the DB password and seeded it). `node db.mjs -c "select 1;"` works → all DB/schema work runs
  through the CLI now. (`sharesefer-service` Keychain still holds the service_role key, but that
  legacy JWT only works for GoTrue admin, not the Data API — use the DB CLI for SQL.)

## State
- **DONE:** Google one-click login (live). Account migration **applied & verified** —
  Ohad's 55 books + 54 listings + profile now on his real login
  `e4b9e9a2-c9e2-4839-8cfb-3bb23929b5c3` (`ohad.zs100@gmail.com`); old no-dot account emptied.
  SQL recorded in `supabase/migrations/20260626_01_*.sql`.
- **DONE — cleanup (2026-06-26):** the two dead auth users (old no-dot `75bccbd4…`,
  `daniel.demo` `a36541b9…`) deleted. The DB-URI Keychain was never seeded (DB password
  unknown), so this ran via the GoTrue **admin API** using the `service_role` key
  (Keychain item `sharesefer-service`, seeded by Ohad) — not the Postgres CLI.
  Verified after: only the real account `e4b9e9a2` (ohad.zs100@gmail.com) remains.
- **Confirm UI:** Ohad should refresh sharesefer.pages.dev (signed in w/ Google) → "הספרים שלי"
  shows 55 books. (He can do this; you don't need the browser.)

## Goodreads/IMDB-for-Hebrew — progress (memory `sharesefer-imdb-vision`)
- ✅ **Schema applied** (`migrations/20260626_03_*`): `library_entries` (per-user per-book
  statuses own/read/want_to_read/want_to_buy/interested + rating + review) and `follows`
  (social graph). 54 listings backfilled to 'own'.
- ✅ **Frontend (deployed):** book page shows "המדף שלי" — status chips + 1–5 rating (on 'read')
  + per-status counts. Book pages now render for any book, not only lent ones.
- **NEXT:** (a) a **shelf browse view** — see ALL books by status, not just the lending catalog
  (catalog still only surfaces available listings); (b) **social** UI — profile pages, follow
  button, "people who own/want this"; (c) **enrichment** — data is sparse (year=NULL, ~1 tag,
  no covers); (d) fold in `library/books.md` (147 books) + `~/dev/library-mirror` → sifriya.

## Standing rules in play
- Apple Reminders "Handle login" is already completed. If new work maps to a reminder, ask at the
  end before marking done (memory `ask-to-mark-reminders-done`).
- Commit AND push when done (memory `always-commit-and-push`).
