# ShareSefer — setup (one-time, ~10 min)

A community book-lending site: users sign in with Google (one click), add books they own
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

## 3. Enable Google sign-in
**a. Google Cloud** (https://console.cloud.google.com → *APIs & Services → Credentials*):
- **Create credentials → OAuth client ID → Web application**.
- Under **Authorised redirect URIs** add your Supabase callback:
  `https://<project-ref>.supabase.co/auth/v1/callback` (shown in step 3b).
- Copy the **Client ID** + **Client secret**.
- In *Google Auth Platform → Audience*, **Publish app** to production so any Google user can sign in
  (basic `email`/`profile` scopes need no Google verification).

**b. Supabase** (*Authentication → Sign In / Providers → Google*):
- Toggle **Enable Sign in with Google**, paste the **Client ID** + **Client secret**, **Save**.
- *Authentication → URL Configuration*: **Site URL** = your deployed URL
  (e.g. `https://sharesefer.pages.dev`); **Redirect URLs**: add the deployed URL and
  `http://localhost:8000/**`.

## 4. Test locally
```
cd sharesefer && python3 -m http.server 8000
```
Open http://localhost:8000 → **התחברות → Sign in with Google** → pick your account →
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
