const CFG = window.BOOKSHARE_CONFIG || {};
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

let sb = null;        // supabase client
let session = null;   // auth session
let profile = null;   // current user's profile row

const ISRAEL_CITIES = ["תל אביב-יפו","ירושלים","חיפה","ראשון לציון","פתח תקווה","אשדוד","נתניה","באר שבע","בני ברק","חולון","רמת גן","אשקלון","רחובות","בת ים","בית שמש","כפר סבא","הרצליה","חדרה","מודיעין-מכבים-רעות","נצרת","לוד","רמלה","רעננה","גבעתיים","הוד השרון","קריית אתא","נהריה","קריית גת","אילת","ראש העין","עפולה","קריית ביאליק","קריית מוצקין","קריית ים","קריית אונו","נס ציונה","אום אל-פחם","יבנה","אור יהודה","צפת","דימונה","טבריה","טייבה","קריית שמונה","נשר","יקנעם עילית","כרמיאל","מעלות-תרשיחא","שדרות","אופקים","נתיבות","ערד","מגדל העמק","בית שאן","קריית מלאכי","טמרה","סח'נין","באקה אל-גרבייה","טירה","אריאל","מעלה אדומים","ביתר עילית","מודיעין עילית","גבעת שמואל","אזור","יהוד-מונוסון","רמת השרון","גני תקווה","קדימה-צורן","פרדס חנה-כרכור","זכרון יעקב","בנימינה-גבעת עדה","אור עקיבא","טירת כרמל","עכו","שפרעם","נוף הגליל","כפר קאסם","רהט","אלעד","כפר יונה","להבים","עומר","מיתר","כוכב יאיר","שוהם","סביון","ראש פינה","קצרין","ירוחם","מצפה רמון","גן יבנה","באר יעקב","פוריידיס","ג'דיידה-מכר","מגאר","כפר ורדים","עתלית","קיסריה"];
function populateCities() {
  const dl = $("cities"); if (!dl || dl.children.length) return;
  dl.innerHTML = ISRAEL_CITIES.map(c => `<option value="${esc(c)}">`).join("");
}

// Fixed genre vocabulary (users pick from this — they can't invent labels)
const GENRES = ["ספרות","שירה","מחזה","סיפורים קצרים","מדע בדיוני","פנטזיה","מתח ובלש","פילוסופיה","פסיכולוגיה","מדע","מתמטיקה","פיזיקה","היסטוריה","ביוגרפיה","יהדות","דת ורוחניות","כלכלה","עסקים","התפתחות אישית","פוליטיקה","חברה","אמנות","קולנוע","מוזיקה","ילדים ונוער","בריאות ותזונה","בישול","טבע ומסעות","חינוך","אסטרטגיה","עיון"];
function renderGenres(selected) {
  const sel = new Set(selected || []);
  $("b-genres").innerHTML = GENRES.map(g =>
    `<button type="button" class="chip gpick ${sel.has(g) ? "on" : ""}" data-g="${esc(g)}">${esc(g)}</button>`).join("");
  $("b-genres").querySelectorAll(".gpick").forEach(b => b.addEventListener("click", () => b.classList.toggle("on")));
}
function selectedGenres() {
  return [...$("b-genres").querySelectorAll(".gpick.on")].map(b => b.dataset.g);
}

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
  setupScan();
  populateCities();

  // Browsing is public — no login needed. Load the catalog for everyone.
  const { data } = await sb.auth.getSession();
  session = data.session;
  if (session) profile = await loadProfile();
  updateNav();
  const params = new URLSearchParams(location.search);
  if (params.get("book")) openBook(params.get("book"));
  else if (params.get("user")) openUser(params.get("user"));
  else openCatalog();

  // React only to real login/logout — NOT to INITIAL_SESSION/TOKEN_REFRESHED,
  // which fire on every load and would clobber a ?book deep link.
  sb.auth.onAuthStateChange(async (event, s) => {
    if (event !== "SIGNED_IN" && event !== "SIGNED_OUT") return;
    session = s;
    profile = session ? await loadProfile() : null;
    updateNav();
    if (session && (!profile || !profile.name || !profile.whatsapp || !profile.city)) openProfile();
    else openCatalog();
  });
}

function setupDonate() {
  const d = CFG.donate;
  if (d && d.url) {
    const el = $("donate");
    el.href = d.url; el.textContent = d.label || "☕ תרמו"; el.hidden = false;
  }
  if (CFG.contactWhatsapp) {
    const c = $("site-contact");
    c.href = `https://wa.me/${waNumber(CFG.contactWhatsapp)}`;
    c.hidden = false;
  }
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
  $("google-signin").addEventListener("click", async () => {
    $("auth-msg").textContent = "מעביר ל‑Google…";
    const { error } = await sb.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: location.href.split("#")[0].split("?")[0] },
    });
    if (error) $("auth-msg").textContent = "שגיאה: " + error.message;
  });
  $("signout").addEventListener("click", () => sb.auth.signOut());
  $("signin").addEventListener("click", requireLogin);
  document.querySelectorAll(".nav .link[data-view]").forEach(b =>
    b.addEventListener("click", () => {
      const v = b.dataset.view;
      if (v === "catalog") return openCatalog();      // public
      if (!session) return requireLogin();            // add / profile / shelf / mybooks need login
      if (v === "add") openAdd();
      else if (v === "shelf") openShelf();
      else if (v === "mybooks") openMyBooks();
      else openProfile();
    }));
  $("search").addEventListener("input", applyFilters);
  $("adv-toggle").addEventListener("click", () => {
    const a = $("adv-filters"); a.hidden = !a.hidden;
    $("adv-toggle").classList.toggle("on", !a.hidden);
  });
  $("add-search").addEventListener("input", searchExisting);
  $("add-form").addEventListener("submit", addNewBook);
  $("profile-form").addEventListener("submit", saveProfile);
  $("b-photo").addEventListener("change", () =>
    $("file-label").textContent = $("b-photo").files[0]
      ? "📷 " + $("b-photo").files[0].name : "📷 תמונת הספר");
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

// ── catalog (grouped by book — a book can have several owners) ───────────────
let allBooks = [];   // [{ book, owners:[{name,whatsapp,city}] }]
async function openCatalog() {
  show("catalog");
  history.replaceState(null, "", location.pathname);   // drop ?book
  const { data, error } = await sb.from("listings")
    .select("id, available, books(id, title, author, year, publisher, language, photo_url, tags), profiles(name, whatsapp, city)")
    .eq("available", true)
    .order("created_at", { ascending: false });
  if (error) { $("grid").innerHTML = `<p class='empty'>שגיאה: ${esc(error.message)}</p>`; return; }
  const byBook = new Map();
  (data || []).forEach(l => {
    const b = l.books; if (!b) return;
    if (!byBook.has(b.id)) byBook.set(b.id, { book: b, owners: [] });
    byBook.get(b.id).owners.push(l.profiles || {});
  });
  allBooks = [...byBook.values()];
  buildFilters();
  applyFilters();
}
const bookCities = (e) => [...new Set(e.owners.map(o => o.city).filter(Boolean))];
function renderCatalog(list) {
  $("catalog-empty").hidden = list.length > 0;
  $("count").textContent = list.length ? `${list.length} ספרים` : "";
  $("grid").replaceChildren(...list.map(card));
}

// ── filters: quick (city · near · genres) + advanced (language · owner) ──────
let fCity = "", fTags = new Set(), fLang = "", fOwner = "";
function buildFilters() {
  const cs = [...new Set(allBooks.flatMap(bookCities))].sort();
  const tags = [...new Set(allBooks.flatMap(e => e.book.tags || []))].sort();
  let html = "";
  if (cs.length) html += `<select id="f-city"><option value="">כל הערים</option>` +
    cs.map(c => `<option ${c === fCity ? "selected" : ""}>${esc(c)}</option>`).join("") + `</select>`;
  if (profile && profile.city) html += `<button class="chip near" id="f-near">📍 קרוב אליי</button>`;
  if (tags.length) html += `<div class="tagfilter">` +
    tags.map(t => `<button class="chip tag ${fTags.has(t) ? "on" : ""}" data-tag="${esc(t)}">${esc(t)}</button>`).join("") + `</div>`;
  $("filters").innerHTML = html;
  if ($("f-city")) $("f-city").addEventListener("change", e => { fCity = e.target.value; applyFilters(); });
  if ($("f-near")) $("f-near").addEventListener("click", () => { fCity = profile.city; buildFilters(); applyFilters(); });
  $("filters").querySelectorAll(".chip.tag").forEach(b => b.addEventListener("click", () => {
    const t = b.dataset.tag; fTags.has(t) ? fTags.delete(t) : fTags.add(t); b.classList.toggle("on"); applyFilters();
  }));
  buildAdvFilters();
}
function buildAdvFilters() {
  const langs = [...new Set(allBooks.map(e => e.book.language).filter(Boolean))].sort();
  const owners = [...new Set(allBooks.flatMap(e => e.owners.map(o => o.name).filter(Boolean)))].sort();
  let html = `<label class="fl">שפה <select id="f-lang"><option value="">הכל</option>` +
    langs.map(l => `<option ${l === fLang ? "selected" : ""}>${esc(l)}</option>`).join("") + `</select></label>`;
  html += `<label class="fl">משתף <select id="f-owner"><option value="">כולם</option>` +
    owners.map(o => `<option ${o === fOwner ? "selected" : ""}>${esc(o)}</option>`).join("") + `</select></label>`;
  html += `<button class="chip" id="f-clear">נקה הכל</button>`;
  $("adv-filters").innerHTML = html;
  $("f-lang").addEventListener("change", e => { fLang = e.target.value; applyFilters(); });
  $("f-owner").addEventListener("change", e => { fOwner = e.target.value; applyFilters(); });
  $("f-clear").addEventListener("click", () => { fCity = fLang = fOwner = ""; fTags.clear(); $("search").value = ""; buildFilters(); applyFilters(); });
}
function applyFilters() {
  const q = $("search").value.trim().toLowerCase();
  let list = allBooks;
  if (q) list = list.filter(e => (e.book.title || "").toLowerCase().includes(q) || (e.book.author || "").toLowerCase().includes(q));
  if (fCity) list = list.filter(e => bookCities(e).includes(fCity));
  if (fLang) list = list.filter(e => e.book.language === fLang);
  if (fOwner) list = list.filter(e => e.owners.some(o => o.name === fOwner));
  if (fTags.size) list = list.filter(e => { const t = e.book.tags || []; return [...fTags].every(x => t.includes(x)); });
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
// Card: one per book, links to its page. Contact lives on the book page only.
function card(entry) {
  const b = entry.book;
  const meta = [b.author, b.year, b.publisher, (b.language && b.language !== "עברית") ? b.language : null].filter(Boolean).map(esc).join(" · ");
  const tags = (b.tags || []).map(t => `<span class="tag-chip">${esc(t)}</span>`).join("");
  const cs = bookCities(entry);
  const csTxt = cs.length ? "📍 " + cs.slice(0, 3).map(esc).join(" · ") + (cs.length > 3 ? ` +${cs.length - 3}` : "") : "";
  const n = entry.owners.length;
  const el = document.createElement("article");
  el.className = "card clickable";
  el.innerHTML = `
    <div class="cover" data-cover>${b.photo_url ? `<img src="${esc(b.photo_url)}" alt="" loading="lazy">` : `<span class="ph">📚</span>`}</div>
    <div class="body">
      <div class="title">${esc(b.title)}</div>
      ${meta ? `<div class="author">${meta}</div>` : ""}
      ${csTxt ? `<div class="loc">${csTxt}</div>` : ""}
      ${tags ? `<div class="tags">${tags}</div>` : ""}
      <div class="spacer"></div>
      <span class="borrow details">לפרטים · ${n} ${n === 1 ? "משתף" : "משתפים"} ←</span>
    </div>`;
  el.addEventListener("click", () => openBook(b.id));
  if (!b.photo_url) fetchCover(b.title, b.author).then(url => {
    if (url) el.querySelector("[data-cover]").innerHTML = `<img src="${url}" alt="" loading="lazy">`;
  });
  return el;
}

// ── shelves (Goodreads-for-Hebrew layer): per-book status + rating ───────────
// Status vocab must match the library_entries.statuses_vocab DB constraint.
const SHELF = [
  ["own", "יש לי"], ["read", "קראתי"], ["want_to_read", "רוצה לקרוא"],
  ["want_to_buy", "רוצה לקנות"], ["interested", "מעניין אותי"],
];
const SHELF_LABEL = Object.fromEntries(SHELF);
let myShelf = { statuses: new Set(), rating: null };   // current book, current user

// Fetch the signed-in user's shelf row + per-status counts for a book.
// Wrapped so the page still works if the migration (library_entries) isn't applied yet.
async function loadShelf(bookId) {
  myShelf = { statuses: new Set(), rating: null };
  const counts = {};
  try {
    const { data: all, error } = await sb.from("library_entries").select("user_id, statuses, rating").eq("book_id", bookId);
    if (error) return { counts, ok: false };
    (all || []).forEach(r => {
      (r.statuses || []).forEach(s => { counts[s] = (counts[s] || 0) + 1; });
      if (session && r.user_id === session.user.id) {
        myShelf = { statuses: new Set(r.statuses || []), rating: r.rating ?? null };
      }
    });
    return { counts, ok: true };
  } catch (e) { return { counts, ok: false }; }
}
async function saveShelf(bookId) {
  const statuses = [...myShelf.statuses];
  const { error } = await sb.from("library_entries").upsert({
    user_id: session.user.id, book_id: bookId,
    statuses, rating: myShelf.rating, updated_at: new Date().toISOString(),
  });
  return error;
}
function shelfControlHTML() {
  const chips = SHELF.map(([k, label]) =>
    `<button type="button" class="chip shelf ${myShelf.statuses.has(k) ? "on" : ""}" data-s="${k}">${esc(label)}</button>`).join("");
  const read = myShelf.statuses.has("read");
  const stars = read ? `<div class="rating" data-rating>${[1, 2, 3, 4, 5].map(n =>
    `<button type="button" class="star ${myShelf.rating >= n ? "on" : ""}" data-n="${n}">★</button>`).join("")}</div>` : "";
  return `<div class="shelfbox"><div class="shelf-label">המדף שלי</div>
    <div class="shelf-chips" data-shelf>${chips}</div>${stars}
    <span class="hint" id="shelf-msg"></span></div>`;
}
function wireShelf(bookId) {
  const box = $("view-book").querySelector("[data-shelf]");
  if (!box) return;
  box.querySelectorAll(".shelf").forEach(b => b.addEventListener("click", async () => {
    const s = b.dataset.s;
    myShelf.statuses.has(s) ? myShelf.statuses.delete(s) : myShelf.statuses.add(s);
    if (!myShelf.statuses.has("read")) myShelf.rating = null;   // rating only meaningful once read
    b.classList.toggle("on");
    const msg = $("shelf-msg"); msg.textContent = "שומר…";
    const err = await saveShelf(bookId);
    msg.textContent = err ? "שגיאה: " + err.message : "נשמר ✓";
    if (!err) openBook(bookId);   // re-render so the rating stars appear/disappear
  }));
  $("view-book").querySelectorAll(".star").forEach(st => st.addEventListener("click", async () => {
    myShelf.rating = parseInt(st.dataset.n, 10);
    $("view-book").querySelectorAll(".star").forEach(s => s.classList.toggle("on", parseInt(s.dataset.n, 10) <= myShelf.rating));
    const msg = $("shelf-msg"); msg.textContent = "שומר…";
    const err = await saveShelf(bookId);
    msg.textContent = err ? "שגיאה: " + err.message : "נשמר ✓";
  }));
}
function shelfStatsHTML(counts) {
  const parts = SHELF.map(([k, label]) => counts[k] ? `${counts[k]} ${esc(label)}` : null).filter(Boolean);
  return parts.length ? `<p class="shelf-stats">${parts.join(" · ")}</p>` : "";
}
// Who has this book on their shelf, by status — names link to their profile.
function readersHTML(rows) {
  rows = rows || [];
  const byStatus = {};
  rows.forEach(r => (r.statuses || []).forEach(s => { (byStatus[s] = byStatus[s] || []).push(r.profiles || {}); }));
  const blocks = SHELF.map(([k, label]) => {
    const ppl = byStatus[k]; if (!ppl || !ppl.length) return "";
    const names = ppl.slice(0, 8).map(p => p.id
      ? `<span class="ulink" data-user="${esc(p.id)}">${esc(p.name || "קורא/ת")}</span>`
      : esc(p.name || "קורא/ת")).join(" · ");
    const more = ppl.length > 8 ? ` +${ppl.length - 8}` : "";
    return `<div class="reader-line"><span class="rl-label">${esc(label)} (${ppl.length}):</span> ${names}${more}</div>`;
  }).filter(Boolean).join("");
  return blocks ? `<div class="readers">${blocks}</div>` : "";
}
function wireUserLinks(root) {
  root.querySelectorAll(".ulink[data-user]").forEach(el => {
    const uid = el.dataset.user; if (!uid) return;
    el.addEventListener("click", (e) => { e.stopPropagation(); openUser(uid); });
  });
}

// ── single book page: details + my shelf + everyone who lends it + contact ───
async function openBook(id) {
  show("book");
  history.replaceState(null, "", `?book=${id}`);
  $("view-book").innerHTML = `<p class="hint">טוען…</p>`;
  // The book itself (works even when nobody lends it), its lenders, shelf data, readers.
  const [{ data: b, error: bErr }, lendRes, shelf, readersRes] = await Promise.all([
    sb.from("books").select("id, title, author, year, publisher, language, photo_url, tags").eq("id", id).maybeSingle(),
    sb.from("listings").select("id, profiles(id, name, whatsapp, city)").eq("book_id", id).eq("available", true),
    loadShelf(id),
    sb.from("library_entries").select("statuses, profiles(id, name)").eq("book_id", id),
  ]);
  if (bErr || !b) {
    $("view-book").innerHTML = `<button class="chip back" onclick="openCatalog()">← לספרייה</button><p class="empty">הספר לא נמצא.</p>`;
    return;
  }
  const data = lendRes.data || [];
  const meta = [b.author, b.year, b.publisher, b.language].filter(Boolean).map(esc).join(" · ");
  const tags = (b.tags || []).map(t => `<span class="tag-chip">${esc(t)}</span>`).join("");
  const lenders = data.map(l => {
    const o = l.profiles || {}, wa = waNumber(o.whatsapp);
    const msg = encodeURIComponent(`היי ${o.name || ""}, אשמח להשאיל את "${b.title}". תודה!`);
    return `<div class="lender">
      <span><b class="ulink" data-user="${esc(o.id || "")}">${esc(o.name || "משתף")}</b>${o.city ? ` · 📍 ${esc(o.city)}` : ""}</span>
      ${wa ? `<a class="borrow" target="_blank" rel="noopener" href="https://wa.me/${wa}?text=${msg}">📲 בקשה בוואטסאפ</a>` : `<span class="borrow disabled">אין יצירת קשר</span>`}
    </div>`;
  }).join("");
  const lendBlock = data.length
    ? `<h3>אצל ${data.length} ${data.length === 1 ? "אדם" : "אנשים"}</h3>
       <div class="lenders">${lenders}</div>
       <p class="hint safety">⚠️ היזהרו במסירת פרטים אישיים. מומלץ להיפגש במקום ציבורי. ShareSefer אינו צד לעסקה.</p>`
    : `<p class="hint">אף אחד לא משתף את הספר הזה כרגע.</p>`;
  $("view-book").innerHTML = `
    <button class="chip back" onclick="openCatalog()">← לספרייה</button>
    <div class="bookpage">
      <div class="bp-cover" data-cover>${b.photo_url ? `<img src="${esc(b.photo_url)}" alt="">` : `<span class="ph">📚</span>`}</div>
      <div class="bp-info">
        <h2>${esc(b.title)}</h2>
        ${meta ? `<p class="author">${meta}</p>` : ""}
        ${tags ? `<div class="tags">${tags}</div>` : ""}
        ${session && shelf.ok ? shelfControlHTML() : ""}
        ${readersHTML(readersRes.data)}
        ${lendBlock}
      </div>
    </div>`;
  if (session && shelf.ok) wireShelf(id);
  wireUserLinks($("view-book"));
  if (!b.photo_url) fetchCover(b.title, b.author).then(url => {
    const c = $("view-book").querySelector("[data-cover]"); if (url && c) c.innerHTML = `<img src="${url}" alt="">`;
  });
}

// ── social: public profiles + follow ────────────────────────────────────────
async function loadFollowState(userId) {
  const me = session ? session.user.id : null;
  const [followers, following, mine] = await Promise.all([
    sb.from("follows").select("*", { count: "exact", head: true }).eq("followee", userId),
    sb.from("follows").select("*", { count: "exact", head: true }).eq("follower", userId),
    me ? sb.from("follows").select("followee", { head: true, count: "exact" }).eq("follower", me).eq("followee", userId) : Promise.resolve({ count: 0 }),
  ]);
  return { followers: followers.count || 0, following: following.count || 0, iFollow: (mine.count || 0) > 0 };
}
let userFilter = "";   // status filter on a profile page
async function openUser(userId) {
  show("user");
  userFilter = "";
  history.replaceState(null, "", `?user=${userId}`);
  $("view-user").innerHTML = `<p class="hint">טוען…</p>`;
  const [{ data: prof }, { data: entries }, fs] = await Promise.all([
    sb.from("profiles").select("name, city").eq("id", userId).maybeSingle(),
    sb.from("library_entries").select("statuses, rating, books(id, title, author, year, photo_url)").eq("user_id", userId),
    loadFollowState(userId),
  ]);
  if (!prof) { $("view-user").innerHTML = `<button class="chip back" onclick="openCatalog()">← לספרייה</button><p class="empty">משתמש לא נמצא.</p>`; return; }
  userShelf = (entries || []).filter(e => e.books).map(e => ({ book: e.books, statuses: e.statuses || [], rating: e.rating }));
  const isSelf = session && session.user.id === userId;
  const followBtn = (session && !isSelf)
    ? `<button class="btn-follow ${fs.iFollow ? "on" : ""}" data-follow="${userId}">${fs.iFollow ? "עוקב/ת ✓" : "+ עקבו"}</button>` : "";
  $("view-user").innerHTML = `
    <button class="chip back" onclick="openCatalog()">← לספרייה</button>
    <div class="profile-head">
      <div class="avatar">${esc((prof.name || "?").trim().charAt(0))}</div>
      <div>
        <h2>${esc(prof.name || "קורא/ת")}</h2>
        ${prof.city ? `<p class="loc">📍 ${esc(prof.city)}</p>` : ""}
        <p class="follow-stats">${userShelf.length} ספרים · ${fs.followers} עוקבים · ${fs.following} עוקב/ת אחרי</p>
      </div>
      ${followBtn}
    </div>
    <div class="filters" id="user-filters"></div>
    <main id="user-grid" class="grid"></main>`;
  const fb = $("view-user").querySelector("[data-follow]");
  if (fb) fb.addEventListener("click", () => toggleFollow(userId));
  buildUserFilters(); renderUserShelf();
}
let userShelf = [];
function buildUserFilters() {
  const counts = {};
  userShelf.forEach(e => e.statuses.forEach(s => { counts[s] = (counts[s] || 0) + 1; }));
  let html = `<button class="chip ${userFilter === "" ? "on" : ""}" data-f="">הכל (${userShelf.length})</button>`;
  html += SHELF.map(([k, label]) => counts[k]
    ? `<button class="chip ${userFilter === k ? "on" : ""}" data-f="${k}">${esc(label)} (${counts[k]})</button>` : "").join("");
  $("user-filters").innerHTML = html;
  $("user-filters").querySelectorAll(".chip").forEach(b => b.addEventListener("click", () => {
    userFilter = b.dataset.f; buildUserFilters(); renderUserShelf();
  }));
}
function renderUserShelf() {
  const list = userFilter ? userShelf.filter(e => e.statuses.includes(userFilter)) : userShelf;
  $("user-grid").replaceChildren(...list.map(shelfCard));
}
async function toggleFollow(userId) {
  if (!session) return requireLogin();
  const { count } = await sb.from("follows").select("followee", { head: true, count: "exact" }).eq("follower", session.user.id).eq("followee", userId);
  if (count > 0) await sb.from("follows").delete().eq("follower", session.user.id).eq("followee", userId);
  else await sb.from("follows").insert({ follower: session.user.id, followee: userId });
  openUser(userId);
}

// ── add / edit book ──────────────────────────────────────────────────────────
let editBookId = null;
function openAdd() {
  editBookId = null;
  show("add");
  $("add-title").textContent = "הוספת ספר";
  $("add-submit").textContent = "הוספה לספרייה שלי";
  $("add-existing").hidden = false;
  $("add-search").value = ""; $("add-matches").innerHTML = "";
  prefillCover = null;
  $("add-form").reset(); $("file-label").textContent = "📷 תמונת הספר";
  $("b-lang").value = "עברית"; renderGenres([]);
  $("add-msg").textContent = "";
}
function openEditBook(b) {
  editBookId = b.id;
  show("add");
  $("add-title").textContent = "עריכת ספר";
  $("add-submit").textContent = "שמירת שינויים";
  $("add-existing").hidden = true;          // editing an existing entry, no search
  $("add-form").reset();
  $("b-title").value = b.title || "";
  $("b-author").value = b.author || "";
  $("b-publisher").value = b.publisher || "";
  $("b-year").value = b.year || "";
  $("b-lang").value = b.language || "עברית";
  renderGenres(b.tags || []);
  $("file-label").textContent = "📷 החלפת תמונה";
  $("add-msg").textContent = "";
}
// Live lookup on Google Books (good Hebrew coverage) → one-tap fill of the whole form.
async function fetchGoogleBooks(q, isbn) {
  if (!CFG.GOOGLE_BOOKS_KEY) return [];
  const term = isbn ? `isbn:${encodeURIComponent(isbn)}` : encodeURIComponent(q);
  try {
    const r = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${term}&maxResults=6&country=IL&key=${CFG.GOOGLE_BOOKS_KEY}`);
    const d = await r.json();
    return (d.items || []).map(it => {
      const v = it.volumeInfo || {}, img = v.imageLinks || {};
      return {
        title: v.title || "", author: (v.authors || []).join(", "),
        year: v.publishedDate ? parseInt(v.publishedDate.slice(0, 4), 10) || "" : "",
        publisher: v.publisher || "",
        language: v.language === "he" ? "עברית" : v.language === "en" ? "אנגלית" : "",
        cover: (img.thumbnail || img.smallThumbnail || "").replace("http://", "https://"),
      };
    }).filter(b => b.title);
  } catch (e) { return []; }
}
// Open Library: keyless + CORS-friendly, so it works with no API-key config.
async function fetchOpenLibrary(q, isbn) {
  const url = isbn
    ? `https://openlibrary.org/search.json?isbn=${encodeURIComponent(isbn)}&limit=4&fields=title,author_name,first_publish_year,cover_i,language`
    : `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=6&fields=title,author_name,first_publish_year,cover_i,language`;
  try {
    const r = await fetch(url); const d = await r.json();
    return (d.docs || []).map(v => ({
      title: v.title || "", author: (v.author_name || []).join(", "),
      year: v.first_publish_year || "", publisher: "",
      language: (v.language || []).includes("heb") ? "עברית" : (v.language || []).includes("eng") ? "אנגלית" : "",
      cover: v.cover_i ? `https://covers.openlibrary.org/b/id/${v.cover_i}-M.jpg` : "",
    })).filter(b => b.title);
  } catch (e) { return []; }
}
// Both online sources, merged + de-duped by title|author. Google has better Hebrew
// metadata but its key is referer-restricted; Open Library always works.
async function fetchOnlineBooks(q, isbn) {
  const [g, o] = await Promise.all([fetchGoogleBooks(q, isbn), fetchOpenLibrary(q, isbn)]);
  const seen = new Set(), out = [];
  [...g, ...o].forEach(b => {
    const k = (b.title + "|" + b.author).toLowerCase().trim();
    if (seen.has(k)) return; seen.add(k); out.push(b);
  });
  return out.slice(0, 8);
}
let prefillCover = null;   // cover URL chosen from an online result (used if no upload)
function prefillFromVolume(v) {
  $("add-existing").hidden = true;            // jump to the (now prefilled) form
  $("b-title").value = v.title || "";
  $("b-author").value = v.author || "";
  $("b-year").value = v.year || "";
  $("b-publisher").value = v.publisher || "";
  $("b-lang").value = v.language || "עברית";
  prefillCover = v.cover || null;
  $("file-label").textContent = v.cover ? "📷 כריכה נטענה — אפשר להחליף" : "📷 תמונת הספר";
  $("add-msg").textContent = "מילאנו את הפרטים — בדקו, ולחצו הוספה ✓";
  window.scrollTo(0, 0);
}
// ── barcode (ISBN) scan → look up on Google Books → prefill ──────────────────
let scanControls = null;
function setupScan() {
  const btn = $("scan-btn");
  if (!btn) return;
  if (!window.ZXingBrowser || !(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) { btn.hidden = true; return; }
  btn.hidden = false;
  btn.addEventListener("click", startScan);
  $("scan-close").addEventListener("click", stopScan);
}
async function startScan() {
  $("scan-overlay").hidden = false;
  try {
    const reader = new ZXingBrowser.BrowserMultiFormatReader();
    scanControls = await reader.decodeFromVideoDevice(undefined, $("scan-video"), (result, err, controls) => {
      if (!result) return;
      const isbn = result.getText().replace(/[^0-9Xx]/g, "");
      try { controls.stop(); } catch (e) {}
      stopScan();
      $("add-search").value = isbn;
      runAddSearch(isbn, isbn);   // search Google by ISBN
    });
  } catch (e) { stopScan(); $("add-msg").textContent = "לא ניתן לפתוח את המצלמה."; }
}
function stopScan() {
  $("scan-overlay").hidden = true;
  if (scanControls) { try { scanControls.stop(); } catch (e) {} scanControls = null; }
}
let searchTimer;
function searchExisting() {
  clearTimeout(searchTimer);
  const q = $("add-search").value.trim();
  if (q.length < 2) { $("add-matches").innerHTML = ""; return; }
  searchTimer = setTimeout(() => runAddSearch(q), 300);
}
async function runAddSearch(q, isbn) {
  $("add-matches").innerHTML = `<p class="hint">מחפש…</p>`;
  const [localRes, online] = await Promise.all([
    isbn ? Promise.resolve({ data: [] }) : sb.from("books").select("id, title, author, year").ilike("title", `%${q}%`).limit(6),
    fetchOnlineBooks(q, isbn),
  ]);
  const local = localRes.data || [];
  $("add-matches").innerHTML = "";
  if (local.length) {
    $("add-matches").insertAdjacentHTML("beforeend", `<div class="match-head">כבר בספרייה — סמנו שזה שלכם</div>`);
    local.forEach(b => {
      const row = document.createElement("div");
      row.className = "match";
      row.innerHTML = `<span>${esc(b.title)}${b.author ? ` <small>· ${esc(b.author)}</small>` : ""}</span><button type="button">זה שלי</button>`;
      row.querySelector("button").addEventListener("click", () => addListing(b.id));
      $("add-matches").appendChild(row);
    });
  }
  if (online.length) {
    $("add-matches").insertAdjacentHTML("beforeend", `<div class="match-head">תוצאות מהאינטרנט — בחרו למילוי אוטומטי</div>`);
    online.forEach(v => {
      const row = document.createElement("div");
      row.className = "match gmatch";
      row.innerHTML = `<span class="gm-cover">${v.cover ? `<img src="${esc(v.cover)}" alt="">` : "📚"}</span>
        <span class="gm-info">${esc(v.title)}${v.author ? ` <small>· ${esc(v.author)}</small>` : ""}${v.year ? ` <small>· ${v.year}</small>` : ""}</span>
        <button type="button">בחר</button>`;
      row.querySelector("button").addEventListener("click", () => prefillFromVolume(v));
      $("add-matches").appendChild(row);
    });
  }
  if (!local.length && !online.length)
    $("add-matches").innerHTML = `<p class="hint">לא נמצא — מלאו ידנית למטה.</p>`;
}
async function addListing(bookId) {
  $("add-msg").textContent = "מוסיף…";
  const { error } = await sb.from("listings").insert({ book_id: bookId, owner: session.user.id });
  $("add-msg").textContent = error
    ? (error.code === "23505" ? "כבר הוספת את הספר הזה." : "שגיאה: " + error.message)
    : "נוסף לספרייה שלך ✓";
  if (!error) { markOwned(bookId); setTimeout(openCatalog, 700); }
}
// Listing a book for lending implies you own it → reflect that on the shelf.
async function markOwned(bookId) {
  try {
    const { data } = await sb.from("library_entries").select("statuses").eq("user_id", session.user.id).eq("book_id", bookId).maybeSingle();
    const statuses = new Set(data?.statuses || []); statuses.add("own");
    await sb.from("library_entries").upsert({ user_id: session.user.id, book_id: bookId, statuses: [...statuses], updated_at: new Date().toISOString() });
  } catch (e) {}
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
  if (!photo_url && prefillCover) photo_url = prefillCover;   // cover picked from Google
  const tags = selectedGenres();
  const fields = {
    title, author: $("b-author").value.trim() || null,
    year: $("b-year").value ? parseInt($("b-year").value, 10) : null,
    publisher: $("b-publisher").value.trim() || null,
    language: $("b-lang").value || "עברית",
    tags: tags.length ? tags : null,
  };
  if (editBookId) {                          // editing an existing catalog entry
    if (photo_url) fields.photo_url = photo_url;
    const { error } = await sb.from("books").update(fields).eq("id", editBookId);
    $("add-msg").textContent = error ? "שגיאה: " + error.message : "נשמר ✓";
    if (!error) setTimeout(openMyBooks, 700);
    return;
  }
  const ins = await sb.from("books").insert({ ...fields, photo_url, created_by: session.user.id })
    .select("id").single();
  if (ins.error) { $("add-msg").textContent = "שגיאה: " + ins.error.message; return; }
  await addListing(ins.data.id);
}

// ── my books (the user's own listings) ───────────────────────────────────────
async function openMyBooks() {
  show("mybooks");
  $("mybooks-msg").textContent = "טוען…";
  const { data, error } = await sb.from("listings")
    .select("id, available, books(id, title, author, year, publisher, language, tags, created_by)")
    .eq("owner", session.user.id)
    .order("created_at", { ascending: false });
  if (error) { $("mybooks-msg").textContent = "שגיאה: " + error.message; return; }
  $("mybooks-msg").textContent = (data && data.length) ? `${data.length} ספרים ברשימה שלך` : "עוד לא הוספת ספרים.";
  $("mybooks-list").replaceChildren(...(data || []).map(myRow));
}
function myRow(l) {
  const b = l.books || {};
  const row = document.createElement("div");
  row.className = "myrow";
  row.innerHTML = `
    <div class="info"><span class="t">${esc(b.title)}</span>${b.author ? ` <small>· ${esc(b.author)}</small>` : ""}</div>
    <div class="acts">
      <button class="mini view">↗ עמוד הספר</button>
      <button class="mini del">🗑 הסר מהרשימה</button>
    </div>`;
  row.querySelector(".view").addEventListener("click", () => openBook(b.id));
  row.querySelector(".del").addEventListener("click", () => removeListing(l.id, b.title));
  return row;
}
async function removeListing(listingId, title) {
  if (!confirm(`להסיר את "${title}" מהרשימה שלך?`)) return;
  const { error } = await sb.from("listings").delete().eq("id", listingId);
  if (error) { $("mybooks-msg").textContent = "שגיאה: " + error.message; return; }
  openMyBooks();
}

// ── my shelf: every book I marked, filterable by status (the IMDB-for-me list) ──
let shelfEntries = [];      // [{ book, statuses:[], rating }]
let shelfFilter = "";       // "" = all, else a status key
async function openShelf() {
  show("shelf");
  $("shelf-grid").innerHTML = `<p class="hint">טוען…</p>`;
  const { data, error } = await sb.from("library_entries")
    .select("statuses, rating, books(id, title, author, year, publisher, language, photo_url, tags)")
    .eq("user_id", session.user.id);
  if (error) { $("shelf-grid").innerHTML = `<p class='empty'>שגיאה: ${esc(error.message)}</p>`; return; }
  shelfEntries = (data || []).filter(e => e.books).map(e => ({ book: e.books, statuses: e.statuses || [], rating: e.rating }));
  buildShelfFilters();
  renderShelf();
}
function buildShelfFilters() {
  const counts = {};
  shelfEntries.forEach(e => e.statuses.forEach(s => { counts[s] = (counts[s] || 0) + 1; }));
  let html = `<button class="chip ${shelfFilter === "" ? "on" : ""}" data-f="">הכל (${shelfEntries.length})</button>`;
  html += SHELF.map(([k, label]) => counts[k]
    ? `<button class="chip ${shelfFilter === k ? "on" : ""}" data-f="${k}">${esc(label)} (${counts[k]})</button>` : "").join("");
  $("shelf-filters").innerHTML = html;
  $("shelf-filters").querySelectorAll(".chip").forEach(b => b.addEventListener("click", () => {
    shelfFilter = b.dataset.f; buildShelfFilters(); renderShelf();
  }));
}
function renderShelf() {
  const list = shelfFilter ? shelfEntries.filter(e => e.statuses.includes(shelfFilter)) : shelfEntries;
  $("shelf-empty").hidden = list.length > 0;
  $("shelf-grid").replaceChildren(...list.map(shelfCard));
}
function shelfCard(entry) {
  const b = entry.book;
  const meta = [b.author, b.year, (b.language && b.language !== "עברית") ? b.language : null].filter(Boolean).map(esc).join(" · ");
  const badges = entry.statuses.map(s => `<span class="tag-chip">${esc(SHELF_LABEL[s] || s)}</span>`).join("");
  const stars = entry.rating ? `<div class="loc">${"★".repeat(entry.rating)}<span style="color:var(--line)">${"★".repeat(5 - entry.rating)}</span></div>` : "";
  const el = document.createElement("article");
  el.className = "card clickable";
  el.innerHTML = `
    <div class="cover" data-cover>${b.photo_url ? `<img src="${esc(b.photo_url)}" alt="" loading="lazy">` : `<span class="ph">📚</span>`}</div>
    <div class="body">
      <div class="title">${esc(b.title)}</div>
      ${meta ? `<div class="author">${meta}</div>` : ""}
      ${stars}
      <div class="tags">${badges}</div>
      <div class="spacer"></div>
      <span class="borrow details">לעדכון ←</span>
    </div>`;
  el.addEventListener("click", () => openBook(b.id));
  if (!b.photo_url) fetchCover(b.title, b.author).then(url => {
    if (url) { const c = el.querySelector("[data-cover]"); if (c) c.innerHTML = `<img src="${url}" alt="" loading="lazy">`; }
  });
  return el;
}

boot();
