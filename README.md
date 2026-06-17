# ShareSefer

A free, community book-lending site. Users sign in by email, list books they own
(from a shared catalog or a new entry with an optional photo), and others request
to borrow over WhatsApp. Hebrew-first / RTL. Static frontend + Supabase backend.

## Setup
See **[SETUP.md](SETUP.md)** — create a free Supabase project, run `supabase/schema.sql`,
paste keys into `config.js`, deploy to Cloudflare Pages.

## Files
| File | What |
|---|---|
| `index.html` | App shell (auth · catalog · add-book · profile views) |
| `app.js` | Logic: auth, catalog, add/search books, photo upload |
| `styles.css` | Styling |
| `config.js` | **Edit:** Supabase URL + anon key + city |
| `supabase/schema.sql` | DB tables, security rules, photo bucket |
| `supabase/seed.sql` | Ohad's 83 Hebrew books (run after first sign-in) |
| `books.json` | Original static seed (Hebrew read books) — source for `seed.sql` |

## Data model
- **profiles** — one per user: name + WhatsApp number.
- **books** — shared catalog (title, author, year, photo), deduplicated across users.
- **listings** — links a catalog book to the user who lends it (`available` flag).

Adding a book searches the shared catalog first; only genuinely new titles create a
new `books` row, so the same book isn't duplicated when several people own it.

## Preview locally
`cd sharesefer && python3 -m http.server 8000` → http://localhost:8000
(needs `config.js` filled in first — otherwise it shows a "connect Supabase" message).
