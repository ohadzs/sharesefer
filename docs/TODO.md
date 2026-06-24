# book-share — TODO

- [ ] **Make the catalog public (no login to browse).** Anyone can view all shared books without signing in. Sign-in is required **only to upload/share books** (and to manage your own listings + profile). Affects: Supabase RLS (public read on `books`/`listings`/`profiles` name+whatsapp), and `app.js` (show catalog before auth; gate the "+ הוספת ספר" / profile views behind login). Added 2026-06-17.
