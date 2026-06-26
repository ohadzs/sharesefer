#!/usr/bin/env node
// Fill missing author / year / publisher / cover on `books` from online sources.
//
//   node enrich-books.mjs [--dry] [--limit N]
//
// Per book missing a field, looks it up (Google Books → Open Library), and fills
// ONLY the empty columns (never overwrites existing data). Idempotent.
// Google Books has the best Hebrew coverage but its key is referer-restricted — if it
// 403s, the book is filled from Open Library only (weak Hebrew). Remove the key's
// restriction (or use an unrestricted key via $GOOGLE_BOOKS_KEY) to unlock Hebrew.

import { execSync } from 'node:child_process';
import pg from 'pg';

const argv = process.argv.slice(2);
const DRY = argv.includes('--dry');
const LIMIT = argv.includes('--limit') ? parseInt(argv[argv.indexOf('--limit') + 1], 10) : null;
const GKEY = process.env.GOOGLE_BOOKS_KEY || 'AIzaSyCRlhX4AWgfw4RiAYa7xc0dwuzOXRQF1IQ';
const conn = () => process.env.DATABASE_URL?.trim()
  || execSync('security find-generic-password -s sharesefer-db -w', { encoding: 'utf8' }).trim();
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function google(title, author) {
  try {
    const q = encodeURIComponent(`intitle:${title}` + (author ? ` inauthor:${author}` : ''));
    const r = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=1&country=IL&key=${GKEY}`);
    const d = await r.json(); const v = d.items?.[0]?.volumeInfo; if (!v) return null;
    const img = v.imageLinks || {};
    return {
      author: (v.authors || []).join(', ') || null,
      year: v.publishedDate ? (parseInt(v.publishedDate.slice(0, 4), 10) || null) : null,
      publisher: v.publisher || null,
      cover: (img.thumbnail || img.smallThumbnail || '').replace('http://', 'https://') || null,
    };
  } catch { return null; }
}
async function openlib(title, author) {
  try {
    const r = await fetch(`https://openlibrary.org/search.json?title=${encodeURIComponent(title)}`
      + (author ? `&author=${encodeURIComponent(author)}` : '')
      + `&limit=1&fields=author_name,first_publish_year,cover_i`);
    const d = await r.json(); const v = d.docs?.[0]; if (!v) return null;
    return {
      author: (v.author_name || []).join(', ') || null,
      year: v.first_publish_year || null, publisher: null,
      cover: v.cover_i ? `https://covers.openlibrary.org/b/id/${v.cover_i}-M.jpg` : null,
    };
  } catch { return null; }
}

const client = new pg.Client({ connectionString: conn() });
await client.connect();
try {
  let q = `select id, title, author, year, publisher, photo_url from books
           where author is null or year is null or photo_url is null order by created_at`;
  if (LIMIT) q += ` limit ${LIMIT}`;
  const books = (await client.query(q)).rows;
  console.log(`${books.length} books missing at least one field`);

  let filled = 0, gHits = 0, oHits = 0, touched = 0;
  for (const b of books) {
    const g = await google(b.title, b.author); if (g) gHits++;
    const o = (!g || !g.author || !g.cover) ? await openlib(b.title, b.author) : null; if (o) oHits++;
    const src = { ...(o || {}), ...(g || {}) };   // prefer Google's fields
    const set = {};
    if (!b.author && src.author) set.author = src.author;
    if (!b.year && src.year) set.year = src.year;
    if (!b.publisher && src.publisher) set.publisher = src.publisher;
    if (!b.photo_url && src.cover) set.photo_url = src.cover;
    const keys = Object.keys(set);
    if (keys.length) {
      filled += keys.length; touched++;
      if (!DRY) {
        await client.query(`update books set ${keys.map((k, i) => `${k}=$${i + 1}`).join(', ')} where id=$${keys.length + 1}`,
          [...keys.map(k => set[k]), b.id]);
      }
    }
    await sleep(120);   // be polite to the APIs
  }
  console.log(`${DRY ? '[DRY] ' : ''}books updated: ${touched}, fields filled: ${filled} (google hits ${gHits}, openlib hits ${oHits})`);
} catch (e) {
  console.error('✗', e.message); process.exitCode = 1;
} finally {
  await client.end();
}
