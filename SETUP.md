# ShareSefer — setup (one-time, ~10 min)

A community book-lending site: users sign in by email, add books they own
(picking from the shared catalog or creating a new one with an optional photo),
and others tap **בקשה בוואטסאפ** to borrow. Static frontend + Supabase backend. Free.

## 1. Create the Supabase project
1. Go to https://supabase.com → sign up (free) → **New project**. Pick a region close to Israel (e.g. Frankfurt).
2. When it's ready: **Project Settings → API**. Copy:
   - **Project URL** → into `config.js` `SUPABASE_URL`
   - **anon public** key → into `config.js` `SUPABASE_ANON_KEY`

## 2. Create the database
1. Supabase → **SQL Editor → New query**.
2. Paste all of `supabase/schema.sql`, **Run**. (Creates tables, security rules, the photo bucket.)

## 3. Allow your site URL for magic-link login
**Authentication → URL Configuration**:
- **Site URL**: your deployed URL (e.g. `https://ShareSefer.pages.dev`). For local testing add `http://localhost:8000`.
- **Redirect URLs**: add both the deployed URL and `http://localhost:8000/`.

## 4. Test locally
```
cd sharesefer && python3 -m http.server 8000
```
Open http://localhost:8000 → enter your email → click the link in the email →
fill name + WhatsApp → you're in.

## 5. Seed Ohad's 83 Hebrew books (optional, after first sign-in)
Once you've signed in once (so your account exists), run `supabase/seed.sql` in the
SQL Editor. It adds the 83 Hebrew books to the shared catalog as your listings.
(It matches your account by `ohadzs100@gmail.com` — edit the email in the file if different.)

## 6. Deploy (Cloudflare Pages)
No build step. Create a Pages project pointing at this folder (framework preset **None**,
build command empty, output dir = this folder). After deploy, update the Site URL in step 3
to the real domain.

## Notes
- The `anon` key is **public by design** — safe to commit. All write access is gated by the
  row-level-security rules in `schema.sql` (users can only edit their own profile/listings).
- Photos go to the public `book-photos` storage bucket.
- WhatsApp number lives in each user's profile, intl format digits only (e.g. `972501234567`).
