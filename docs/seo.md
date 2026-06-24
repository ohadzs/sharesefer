# ShareSefer — SEO plan & goals

_Last updated 2026-06-19._

## Baseline (2026-06-19)
- **Live:** https://sharesefer.pages.dev (Cloudflare Pages). Old `ohadzs.github.io/sharesefer/` also exists.
- **Indexation: ZERO.** `site:sharesefer.pages.dev OR site:ohadzs.github.io` on google.co.il (hl=iw) → "לא תאם אף מסמך". Google has not crawled/indexed any page. Ranks for nothing.
- **On-page (homepage):** good — `lang="he" dir="rtl"`, title `ShareSefer · השאלת ספרים חינם`, meta description, Open Graph + Twitter cards (good for WhatsApp/FB share previews).
- **Structural problem:** it's a **single-page app**. Catalog + per-book pages are rendered by `app.js` from Supabase. Google sees only ONE page (the homepage); books are invisible. Much of the keyword text sits inside `hidden` sections.
- **Missing:** Google Search Console, `robots.txt`, `sitemap.xml`, canonical tag, structured data, per-book URLs.

## Keyword strategy
Tiered by winnability (a new tiny SPA can't fight head terms; win specific + local + niche):

- **Head (long-term stretch, don't target first):** `השאלת ספרים`, `ספרייה דיגיטלית` — owned by libraries, Steimatzky, e-vrit, municipalities.
- **Mid (our positioning):** `השאלת ספרים חינם`, `החלפת ספרים`, `ספרייה קהילתית`, `להשאיל ספרים`.
- **Long-tail + local (START HERE — winnable, no direct Israeli competitor per 2026-06-17 research):**
  `השאלת ספרים חינם`, `השאלת ספרים גבעתיים`, `החלפת ספרים גבעתיים / רמת גן / תל אביב`,
  `שיתוף ספרים בין שכנים`, `ספרייה שכונתית`, `איפה להשאיל ספרים בחינם`.
- **Primary phrase to OWN:** `השאלת ספרים חינם` (+ local Givatayim modifier) and the niche descriptor `שיתוף ספרים בין שכנים`.

## Goals
| Horizon | Goal |
|---|---|
| 30 days | Indexed (`site:` returns pages); #1 for brand ("ShareSefer"/"שר ספר"); top 50 for one long-tail |
| 90 days | Page 1 (top 10) for `השאלת ספרים חינם`, `השאלת ספרים גבעתיים`, `שיתוף ספרים בין שכנים` |
| 6 months | Top 3 for a niche phrase we own; page 1 for several local/long-tail; per-book pages indexed |

## Plan
**Phase 0 — Get seen (week 1):**
1. Add `robots.txt` + `sitemap.xml`; add `<link rel="canonical">`.
2. Google Search Console: verify property (DNS or HTML-file), submit sitemap, Request Indexing on the homepage.

**Phase 1 — On-page (week 1–2):**
1. Move primary keyword text out of `hidden` sections → a visible H1 + a real crawlable intro `<p>` (homepage) describing peer-to-peer free book lending, with city = גבעתיים.
2. Add schema.org structured data (`WebSite`/`Organization`; later `Book`/`Offer`).
3. Local signals (city) in static text + OG.

**Phase 2 — Big lever (weeks 2–6): make books indexable.**
- Pre-render the catalog + a static HTML page **per book** with its own crawlable URL (build script querying Supabase → static pages, or migrate to Astro).
- Turns 1 indexable page into hundreds of long-tail landing pages ("<book name> להשאלה").
- Without this, only the homepage can ever rank.

**Phase 3 — Off-page / distribution (ongoing):**
- Backlinks + referral traffic: post in Facebook book/community groups, local Givatayim groups, link from the blog (ohadzs.pages.dev).
- Links + real traffic are what move rankings beyond on-page.

## Domain note
`*.pages.dev` can rank fine (it's its own site on the Public Suffix List — no shared-spam penalty). Don't buy a domain just for SEO. Revisit `sharesefer.com` only if/when going after head terms, where a brandable, durable domain authority matters. (Ohad's stance: not paying for a free project — fine to stay on pages.dev.)

## Status (2026-06-19)
- ✅ **Phase 0 DONE in code + GSC:** robots.txt, sitemap.xml, canonical, JSON-LD, `<noscript>` copy — all live & deployed.
- ✅ **Google Search Console:** property `https://sharesefer.pages.dev/` **verified** (HTML-tag method; meta tag in `index.html` head — do NOT remove it). Sitemap **submitted** (`/sitemap.xml`; showed transient "Couldn't fetch" right after submit — normal, resolves on next crawl).
- ⏳ **Request Indexing:** hit Google's daily quota ("try again tomorrow") — optional, only speeds crawl. Retry from GSC → URL inspection → Request Indexing.
- **Next:** Phase 2 (static-render books) is the real traffic unlock — not started.

## Status (2026-06-22)
- ✅ **Homepage is INDEXED** — GSC URL inspection on `https://sharesefer.pages.dev/` → **"URL is on Google / Page is indexed"** (served over HTTPS). This flips the 2026-06-19 "indexation ZERO" baseline: the SPA homepage now ranks-eligible. (Note: WebSearch/automated `site:` checks are unreliable here — WebSearch is US-only, and scripted Google queries get blocked. GSC URL-inspection is the source of truth.)
- ✅ **GSC property re-created + auto-verified** — on the Welcome screen no property existed today (the Jun-19 one wasn't there). Re-added as **URL-prefix** `https://sharesefer.pages.dev/`, auto-verified via the live HTML meta tag. Account: ohad.zs100@gmail.com. ⚠️ Domain-type (`sc-domain:`) does NOT work — needs DNS on Cloudflare's pages.dev; always use URL-prefix.
- ✅ **Sitemap resubmitted** (`/sitemap.xml`, Submitted 22 Jun). Old entry showed "Couldn't fetch" (from when unverified); file returns 200, will re-read fine. Sitemap only lists the homepage — Phase 2 needed for per-book URLs.
- ✅ **Re-crawl requested** on the homepage (after the new SEO tags).
- **Next:** Phase 2 (static-render books) is still the real traffic unlock — not started.

## Tracking
- Check indexation via **GSC → URL inspection** (reliable), not scripted `site:` queries. Manual `site:sharesefer.pages.dev` in a browser on google.co.il (hl=iw) also works.
- Track impressions/positions in GSC (Performance) — the real source of truth — once data appears (~a few days after first crawl).
