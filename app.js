const CFG = window.BOOKSHARE_CONFIG || {};
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

let sb = null;        // supabase client
let session = null;   // auth session
let profile = null;   // current user's profile row

// ── boot ──────────────────────────────────────────────────────────────────
function show(view) {
  document.querySelectorAll(".view").forEach(v => v.hidden = true);
  $("view-" + view).hidden = false;
  document.querySelectorAll(".nav .link[data-view]").forEach(b =>
    b.classList.toggle("active", b.dataset.view === view));
}

async function boot() {
  if (!CFG.SUPABASE_URL || !CFG.SUPABASE_ANON_KEY) { show("setup"); return; }
  sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);
  wire();
  setupDonate();

  // Browsing is public — no login needed. Load the catalog for everyone.
  const { data } = await sb.auth.getSession();
  session = data.session;
  if (session) profile = await loadProfile();
  updateNav();
  openCatalog();

  // React to login/logout (e.g. returning from the magic-link email).
  sb.auth.onAuthStateChange(async (_e, s) => {
    session = s;
    profile = session ? await loadProfile() : null;
    updateNav();
    if (session && (!profile || !profile.name || !profile.whatsapp)) openProfile();
    else openCatalog();
  });
}

function setupDonate() {
  const d = CFG.donate;
  if (!d || !d.url) return;            // hidden until a URL is set in config.js
  const el = $("donate");
  el.href = d.url;
  el.textContent = d.label || "☕ תרמו";
  el.hidden = false;
}

function updateNav() {
  const authed = !!session;
  document.querySelectorAll(".auth-only").forEach(e => e.hidden = !authed);
  document.querySelectorAll(".guest-only").forEach(e => e.hidden = authed);
}

function requireLogin() {
  $("auth-msg").textContent = "";
  show("auth");
}

// ── auth ────────────────────────────────────────────────────────────────────
function wire() {
  $("auth-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = $("auth-email").value.trim();
    $("auth-msg").textContent = "שולח…";
    const { error } = await sb.auth.signInWithOtp({
      email, options: { emailRedirectTo: location.href.split("#")[0] },
    });
    $("auth-msg").textContent = error ? "שגיאה: " + error.message
      : "נשלח קישור כניסה לאימייל. בדקו את התיבה.";
  });
  $("signout").addEventListener("click", () => sb.auth.signOut());
  $("signin").addEventListener("click", requireLogin);
  document.querySelectorAll(".nav .link[data-view]").forEach(b =>
    b.addEventListener("click", () => {
      const v = b.dataset.view;
      if (v === "catalog") return openCatalog();      // public
      if (!session) return requireLogin();            // add / profile need login
      if (v === "add") openAdd();
      else openProfile();
    }));
  $("search").addEventListener("input", applyFilters);
  $("add-search").addEventListener("input", searchExisting);
  $("add-form").addEventListener("submit", addNewBook);
  $("profile-form").addEventListener("submit", saveProfile);
  $("b-photo").addEventListener("change", () =>
    $("file-label").textContent = $("b-photo").files[0]
      ? "📷 " + $("b-photo").files[0].name : "📷 העלאת תמונת הספר (לא חובה)");
}

// ── profile ──────────────────────────────────────────────────────────────────
async function loadProfile() {
  const { data } = await sb.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
  return data;
}
function openProfile() {
  show("profile");
  if (profile) { $("p-name").value = profile.name || ""; $("p-city").value = profile.city || ""; $("p-whatsapp").value = profile.whatsapp || ""; }
}
async function saveProfile(e) {
  e.preventDefault();
  const name = $("p-name").value.trim();
  const city = $("p-city").value.trim() || null;
  const whatsapp = $("p-whatsapp").value.replace(/\D/g, "");
  $("profile-msg").textContent = "שומר…";
  const { error } = await sb.from("profiles")
    .upsert({ id: session.user.id, name, city, whatsapp });
  if (error) { $("profile-msg").textContent = "שגיאה: " + error.message; return; }
  profile = { id: session.user.id, name, city, whatsapp };
  $("profile-msg").textContent = "נשמר ✓";
  openCatalog();
}

// ── catalog ──────────────────────────────────────────────────────────────────
let allListings = [];
async function openCatalog() {
  show("catalog");
  const { data, error } = await sb.from("listings")
    .select("id, available, books(title, author, year, publisher, photo_url, tags), profiles(name, whatsapp, city)")
    .eq("available", true)
    .order("created_at", { ascending: false });
  if (error) { $("grid").innerHTML = `<p class='empty'>שגיאה: ${esc(error.message)}</p>`; return; }
  allListings = data || [];
  buildFilters();
  applyFilters();
}
function renderCatalog(list) {
  $("catalog-empty").hidden = list.length > 0;
  $("count").textContent = list.length ? `${list.length} ספרים זמינים` : "";
  $("grid").replaceChildren(...list.map(card));
}

// ── filters: city + tags + "near me" ─────────────────────────────────────────
let fCity = "", fTags = new Set();
function buildFilters() {
  const cities = [...new Set(allListings.map(l => l.profiles && l.profiles.city).filter(Boolean))].sort();
  const tags = [...new Set(allListings.flatMap(l => (l.books && l.books.tags) || []))].sort();
  let html = "";
  if (cities.length) html += `<select id="f-city"><option value="">כל הערים</option>` +
    cities.map(c => `<option ${c === fCity ? "selected" : ""}>${esc(c)}</option>`).join("") + `</select>`;
  if (profile && profile.city) html += `<button class="chip near" id="f-near">📍 קרוב אליי</button>`;
  if (tags.length) html += `<div class="tagfilter">` +
    tags.map(t => `<button class="chip tag ${fTags.has(t) ? "on" : ""}" data-tag="${esc(t)}">${esc(t)}</button>`).join("") + `</div>`;
  $("filters").innerHTML = html;
  if ($("f-city")) $("f-city").addEventListener("change", e => { fCity = e.target.value; applyFilters(); });
  if ($("f-near")) $("f-near").addEventListener("click", () => { fCity = profile.city; buildFilters(); applyFilters(); });
  $("filters").querySelectorAll(".chip.tag").forEach(b => b.addEventListener("click", () => {
    const t = b.dataset.tag; fTags.has(t) ? fTags.delete(t) : fTags.add(t); b.classList.toggle("on"); applyFilters();
  }));
}
function applyFilters() {
  const q = $("search").value.trim().toLowerCase();
  let list = allListings;
  if (q) list = list.filter(l => { const b = l.books || {}; return (b.title || "").toLowerCase().includes(q) || (b.author || "").toLowerCase().includes(q); });
  if (fCity) list = list.filter(l => (l.profiles && l.profiles.city) === fCity);
  if (fTags.size) list = list.filter(l => { const t = (l.books && l.books.tags) || []; return [...fTags].every(x => t.includes(x)); });
  renderCatalog(list);
}
// Normalize an Israeli number for wa.me: 050-1234567 → 972501234567
function waNumber(raw) {
  let d = String(raw || "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("972")) return d;
  if (d.startsWith("0")) return "972" + d.slice(1);
  return d;
}
// Auto book cover: Google Books first (good Hebrew coverage), Open Library fallback.
const coverCache = {};
async function fetchCover(title, author) {
  const key = title + "|" + (author || "");
  if (key in coverCache) return coverCache[key];
  if (CFG.GOOGLE_BOOKS_KEY) try {   // Google Books (good Hebrew) — needs a free API key
    const q = encodeURIComponent(`intitle:${title}` + (author ? ` inauthor:${author}` : ""));
    const r = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=1&country=IL&key=${CFG.GOOGLE_BOOKS_KEY}`);
    const d = await r.json();
    const img = d.items && d.items[0] && d.items[0].volumeInfo && d.items[0].volumeInfo.imageLinks;
    const u = img && (img.thumbnail || img.smallThumbnail);
    if (u) return coverCache[key] = u.replace("http://", "https://");
  } catch (e) {}
  try {
    const r = await fetch(`https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&limit=1&fields=cover_i`);
    const d = await r.json();
    const id = d.docs && d.docs[0] && d.docs[0].cover_i;
    if (id) return coverCache[key] = `https://covers.openlibrary.org/b/id/${id}-M.jpg`;
  } catch (e) {}
  return coverCache[key] = null;
}
function card(l) {
  const b = l.books || {}, o = l.profiles || {};
  const wa = waNumber(o.whatsapp);
  const name = o.name || "המשתף";
  const msg = encodeURIComponent(`היי ${o.name || ""}, אשמח להשאיל את "${b.title}". תודה!`);
  const meta = [b.author, b.year, b.publisher].filter(Boolean).map(esc).join(" · ");
  const tags = (b.tags || []).map(t => `<span class="tag-chip">${esc(t)}</span>`).join("");
  const el = document.createElement("article");
  el.className = "card";
  el.innerHTML = `
    <div class="cover" data-cover>${b.photo_url ? `<img src="${esc(b.photo_url)}" alt="" loading="lazy">` : `<span class="ph">📚</span>`}</div>
    <div class="body">
      <div class="title">${esc(b.title)}</div>
      ${meta ? `<div class="author">${meta}</div>` : ""}
      ${o.city ? `<div class="loc">📍 ${esc(o.city)}</div>` : ""}
      ${tags ? `<div class="tags">${tags}</div>` : ""}
      <div class="spacer"></div>
      ${wa ? `<a class="borrow" target="_blank" rel="noopener" href="https://wa.me/${wa}?text=${msg}">📲 צור קשר עם ${esc(name)}</a>`
           : `<span class="borrow disabled">אין מספר ליצירת קשר</span>`}
    </div>`;
  if (!b.photo_url) fetchCover(b.title, b.author).then(url => {
    if (url) el.querySelector("[data-cover]").innerHTML = `<img src="${url}" alt="" loading="lazy">`;
  });
  return el;
}

// ── add book ─────────────────────────────────────────────────────────────────
function openAdd() {
  show("add");
  $("add-search").value = ""; $("add-matches").innerHTML = "";
  $("add-form").reset(); $("file-label").textContent = "📷 העלאת תמונת הספר (לא חובה)";
  $("add-msg").textContent = "";
}
let searchTimer;
function searchExisting() {
  clearTimeout(searchTimer);
  const q = $("add-search").value.trim();
  if (q.length < 2) { $("add-matches").innerHTML = ""; return; }
  searchTimer = setTimeout(async () => {
    const { data } = await sb.from("books").select("id, title, author, year")
      .ilike("title", `%${q}%`).limit(8);
    $("add-matches").innerHTML = "";
    (data || []).forEach(b => {
      const row = document.createElement("div");
      row.className = "match";
      row.innerHTML = `<span>${esc(b.title)} ${b.author ? `<small>· ${esc(b.author)}</small>` : ""}</span>
                       <button type="button">זה שלי</button>`;
      row.querySelector("button").addEventListener("click", () => addListing(b.id));
      $("add-matches").appendChild(row);
    });
  }, 250);
}
async function addListing(bookId) {
  $("add-msg").textContent = "מוסיף…";
  const { error } = await sb.from("listings").insert({ book_id: bookId, owner: session.user.id });
  $("add-msg").textContent = error
    ? (error.code === "23505" ? "כבר הוספת את הספר הזה." : "שגיאה: " + error.message)
    : "נוסף לספרייה שלך ✓";
  if (!error) setTimeout(openCatalog, 700);
}
async function addNewBook(e) {
  e.preventDefault();
  const title = $("b-title").value.trim();
  if (!title) return;
  $("add-msg").textContent = "שומר…";
  let photo_url = null;
  const file = $("b-photo").files[0];
  if (file) {
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${session.user.id}/${Date.now()}.${ext}`;
    const up = await sb.storage.from("book-photos").upload(path, file, { upsert: false });
    if (up.error) { $("add-msg").textContent = "שגיאת העלאה: " + up.error.message; return; }
    photo_url = sb.storage.from("book-photos").getPublicUrl(path).data.publicUrl;
  }
  const tags = $("b-tags").value.split(",").map(s => s.trim()).filter(Boolean);
  const ins = await sb.from("books").insert({
    title, author: $("b-author").value.trim() || null,
    year: $("b-year").value ? parseInt($("b-year").value, 10) : null,
    publisher: $("b-publisher").value.trim() || null,
    tags: tags.length ? tags : null,
    photo_url, created_by: session.user.id,
  }).select("id").single();
  if (ins.error) { $("add-msg").textContent = "שגיאה: " + ins.error.message; return; }
  await addListing(ins.data.id);
}

boot();
