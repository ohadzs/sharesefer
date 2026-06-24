# ShareSefer

Free community book-lending site — list books you own, others borrow via WhatsApp.

- **Code:** `~/dev/sharesefer` (static HTML/CSS/JS + Supabase). Own git repo (`github.com/ohadzs/sharesefer`, public). NOT in this hub.
- **Host:** Cloudflare Pages, live at https://sharesefer.pages.dev (deploy `wrangler pages deploy .`) → custom domain **sharesefer.com** (to buy, deferred).
- **Status:** pending Supabase setup (see `~/dev/sharesefer/SETUP.md`).

## SEO notes
- Catalog should be **public** (browse without login); sign-in only to upload/share — see [TODO.md](TODO.md).
- ⚠️ Current build renders client-side, so Google won't index book content well. For real ranking, re-architect the catalog as static-rendered pages (e.g. Astro) — deferred, undecided.
- Link-share preview (Open Graph) added 2026-06-17; add `og:url` + `og:image` once the domain + a share image exist.
