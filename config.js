// ── Supabase connection (publishable key — safe to ship; protected by RLS) ──
window.BOOKSHARE_CONFIG = {
  SUPABASE_URL: "https://dwivtcqhruwgembqhecc.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_5wSqU34uorP83TT8KTeLDQ_e9QpvHO4",
  city: "גבעתיים",        // shown in the intro; clear ("") to hide
  contactWhatsapp: "0544960035",   // site contact (footer "צור קשר"); "" = hide
  GOOGLE_BOOKS_KEY: "AIzaSyCRlhX4AWgfw4RiAYa7xc0dwuzOXRQF1IQ",   // optional free key → auto book covers (incl. Hebrew). Empty = covers from uploads / Open Library only
  donate: {
    url: "https://links.payboxapp.com/pC4JKcnb33b",   // PayBox group link — set this to show the donate button
    label: "🐛 האכילו את תולעת הספרים",
  },
};
