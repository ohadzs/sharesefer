#!/usr/bin/env node
// ShareSefer DB CLI — run SQL against the Supabase Postgres directly, no browser.
//
// Connection string resolution order:
//   1. $DATABASE_URL
//   2. macOS Keychain item "sharesefer-db"  (security find-generic-password -s sharesefer-db -w)
//
// One-time seed (get the URI from Supabase → Project Settings → Database →
//   Connection string → "URI", and paste the real password in):
//   security add-generic-password -s sharesefer-db -a "$USER" -w \
//     'postgresql://postgres.dwivtcqhruwgembqhecc:PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres'
//
// Usage:
//   node db.mjs -c "select count(*) from books;"     # inline SQL
//   node db.mjs -f migration.sql                      # run a .sql file (begin;...commit; ok)
//   echo "select 1" | node db.mjs                     # SQL from stdin
//
// Examples:
//   node db.mjs -c "select id, email from auth.users order by created_at;"
//   node db.mjs -f ../supabase/migrations/20260626_02_cleanup-dead-accounts.sql

import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import pg from 'pg';

function resolveConnString() {
  if (process.env.DATABASE_URL?.trim()) return process.env.DATABASE_URL.trim();
  try {
    return execSync('security find-generic-password -s sharesefer-db -w', { encoding: 'utf8' }).trim();
  } catch {
    console.error('✗ No connection string. Set $DATABASE_URL or seed the Keychain once:');
    console.error('  (Supabase → Project Settings → Database → Connection string → URI)');
    console.error("  security add-generic-password -s sharesefer-db -a \"$USER\" -w 'postgresql://...'");
    process.exit(2);
  }
}

function readSql(argv) {
  const ci = argv.indexOf('-c');
  if (ci !== -1) return argv[ci + 1];
  const fi = argv.indexOf('-f');
  if (fi !== -1) return readFileSync(argv[fi + 1], 'utf8');
  return readFileSync(0, 'utf8'); // stdin
}

const sql = readSql(process.argv.slice(2));
if (!sql?.trim()) {
  console.error('✗ No SQL. Use -c "...", -f file.sql, or pipe via stdin.');
  process.exit(2);
}

const client = new pg.Client({ connectionString: resolveConnString() });
await client.connect();
try {
  const res = await client.query(sql);
  for (const r of (Array.isArray(res) ? res : [res])) {
    if (r.rows?.length) console.table(r.rows);
    else console.log(`${r.command ?? 'OK'}${typeof r.rowCount === 'number' ? ` (${r.rowCount} rows)` : ''}`);
  }
} catch (e) {
  console.error(`✗ ${e.message}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
