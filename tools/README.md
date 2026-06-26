# ShareSefer DB CLI (`tools/`)

Run SQL against the Supabase Postgres **directly from the shell** — no dashboard, no browser.
This replaces driving the Supabase SQL editor by hand.

## One-time setup

```bash
cd ~/dev/sharesefer/tools
npm install            # pulls `pg`
```

Then seed the connection string into the macOS Keychain **once**. Get it from
Supabase → **Project Settings → Database → Connection string → "URI"** (the
pooler URI for project `dwivtcqhruwgembqhecc`), and paste the real password in:

```bash
security add-generic-password -s sharesefer-db -a "$USER" -w \
  'postgresql://postgres.dwivtcqhruwgembqhecc:PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres'
```

(The tool also accepts `$DATABASE_URL` if you'd rather not use the Keychain.)
The URI uses the **postgres** role, so it bypasses RLS — it can run migrations,
read `auth.users`, and delete rows the anon key can't.

## Usage

```bash
node db.mjs -c "select count(*) from books;"        # inline
node db.mjs -f ../supabase/migrations/FILE.sql       # a .sql file (begin;…commit; ok)
echo "select 1" | node db.mjs                        # stdin
```

## Common queries

```bash
# who are the auth users + their listing counts
node db.mjs -c "select u.id, u.email, count(l.*) as listings
  from auth.users u left join listings l on l.owner = u.id group by 1,2 order by 3 desc;"
```

## Why this exists

Last session the account migration had to be pasted into the browser SQL editor
because there was no local DB credential. With the Keychain seeded, all future
DB work (cleanup, the IMDB-status schema additions, enrichment) runs through this
CLI instead of the screen.
