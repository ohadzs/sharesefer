#!/usr/bin/env node
// Import a books.md reading log into the sifriya DB as one user's shelf.
//
//   node import-books.mjs <path-to-books.md> <user_uuid> [--dry]
//
// Parses the 3 tables (Not started / Read / Backlog), maps each row to
// library_entries.statuses + rating, dedupes against existing `books` by title,
// and MERGES with any shelf statuses already there. Idempotent (re-runnable).
//
// Status mapping:
//   Read section      → 'read'        (+ rating from Score, scaled /10 → /5)
//   Not started / Backlog → 'want_to_read'
//   Own? = yes        → + 'own'
//   Own? = should buy → + 'want_to_buy'   (maybe / no → nothing)

import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import pg from 'pg';

const [mdPath, userId, ...rest] = process.argv.slice(2);
const DRY = rest.includes('--dry');
if (!mdPath || !userId) { console.error('usage: node import-books.mjs <books.md> <user_uuid> [--dry]'); process.exit(2); }

function conn() {
  if (process.env.DATABASE_URL?.trim()) return process.env.DATABASE_URL.trim();
  return execSync('security find-generic-password -s sharesefer-db -w', { encoding: 'utf8' }).trim();
}
const norm = (s) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();
const isHebrew = (s) => /[֐-׿]/.test(s || '');

// ── parse books.md ──────────────────────────────────────────────────────────
function parse(md) {
  const out = [];
  let section = null;
  for (const line of md.split('\n')) {
    const h = line.match(/^##\s+(.*)$/);
    if (h) {
      const t = h[1];
      section = /Not started/i.test(t) ? 'want_to_read'
        : /Read/i.test(t) ? 'read'
        : /Backlog/i.test(t) ? 'want_to_read' : null;
      continue;
    }
    if (!section || !line.trim().startsWith('|')) continue;
    const cells = line.split('|').slice(1, -1).map(c => c.trim());
    if (!cells.length || /^title$/i.test(cells[0]) || /^-+$/.test(cells[0])) continue;
    const [title, author, own, c4] = cells;   // c4 = Score (read) | Year/Library (other)
    if (!title) continue;
    const statuses = new Set([section]);
    const o = norm(own);
    if (o === 'yes') statuses.add('own');
    else if (o === 'should buy') statuses.add('want_to_buy');
    let rating = null;
    if (section === 'read' && c4 && /^\d+(\.\d+)?$/.test(c4)) {
      rating = Math.min(5, Math.max(1, Math.round(parseFloat(c4) / 2)));
    }
    out.push({ title, author: author || null, statuses: [...statuses], rating });
  }
  return out;
}

const entries = parse(readFileSync(mdPath, 'utf8'));
console.log(`parsed ${entries.length} rows from ${mdPath}`);

const client = new pg.Client({ connectionString: conn() });
await client.connect();
try {
  await client.query('begin');

  // existing catalog (dedupe by normalized title) + this user's current shelf
  const books = (await client.query('select id, title from books')).rows;
  const byTitle = new Map(books.map(b => [norm(b.title), b.id]));
  const le = (await client.query('select book_id, statuses, rating from library_entries where user_id=$1', [userId])).rows;
  const shelf = new Map(le.map(r => [r.book_id, r]));

  let inserted = 0, upserted = 0;
  for (const e of entries) {
    let bookId = byTitle.get(norm(e.title));
    if (!bookId) {
      const lang = isHebrew(e.title) ? 'עברית' : 'אנגלית';
      const r = await client.query(
        'insert into books(title, author, language, created_by) values($1,$2,$3,$4) returning id',
        [e.title, e.author, lang, userId]);
      bookId = r.rows[0].id; byTitle.set(norm(e.title), bookId); inserted++;
    }
    const cur = shelf.get(bookId);
    const merged = [...new Set([...(cur?.statuses || []), ...e.statuses])];
    const rating = e.rating ?? cur?.rating ?? null;
    await client.query(
      `insert into library_entries(user_id, book_id, statuses, rating, updated_at)
         values($1,$2,$3,$4, now())
       on conflict (user_id, book_id) do update set statuses=$3, rating=coalesce($4, library_entries.rating), updated_at=now()`,
      [userId, bookId, merged, rating]);
    shelf.set(bookId, { book_id: bookId, statuses: merged, rating });
    upserted++;
  }

  if (DRY) { await client.query('rollback'); console.log('DRY RUN — rolled back'); }
  else await client.query('commit');
  console.log(`books inserted: ${inserted}, shelf entries upserted: ${upserted}`);
} catch (e) {
  await client.query('rollback');
  console.error('✗', e.message); process.exitCode = 1;
} finally {
  await client.end();
}
