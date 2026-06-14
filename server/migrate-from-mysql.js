// One-time importer: reads a phpMyAdmin / MariaDB dump and inserts the data into the SQLite DB.
//
// Usage:
//   node migrate-from-mysql.js                 (defaults to ../sas_accounts.sql)
//   node migrate-from-mysql.js path/to/dump.sql
//
// Safe to re-run only if you first delete the .db file — otherwise UNIQUE constraints
// (places.name, base_products.name) and explicit ids will conflict.

const fs = require('fs');
const path = require('path');
const { _db: db } = require('./db');

const dumpPath = process.argv[2] || path.join(__dirname, '..', 'sas_accounts.sql');
if (!fs.existsSync(dumpPath)) {
  console.error(`Dump file not found: ${dumpPath}`);
  process.exit(1);
}

const raw = fs.readFileSync(dumpPath, 'utf8');

// Pull out every INSERT statement (they can span multiple lines).
const stmts = [];
let buf = '';
let inInsert = false;
for (const line of raw.split(/\r?\n/)) {
  if (!inInsert) {
    if (/^\s*INSERT\s+INTO\s+/i.test(line)) {
      inInsert = true;
      buf = line;
      if (/;\s*$/.test(line)) { stmts.push(buf); buf = ''; inInsert = false; }
    }
  } else {
    buf += '\n' + line;
    if (/;\s*$/.test(line)) { stmts.push(buf); buf = ''; inInsert = false; }
  }
}

// Group by table; we insert in FK-safe order.
const byTable = new Map();
for (const s of stmts) {
  const m = s.match(/^\s*INSERT\s+INTO\s+`?([A-Za-z_][A-Za-z0-9_]*)`?/i);
  if (!m) continue;
  const t = m[1];
  if (!byTable.has(t)) byTable.set(t, []);
  byTable.get(t).push(s);
}
const insertOrder = ['places', 'base_products', 'customers', 'products', 'bills', 'bill_items', 'payments'];

console.log(`Found ${stmts.length} INSERT statement(s) across ${byTable.size} table(s).`);

db.exec('BEGIN');
try {
  for (const t of insertOrder) {
    const list = byTable.get(t) || [];
    for (const s of list) {
      try { db.exec(s); }
      catch (e) {
        console.error(`Error inserting into ${t}: ${e.message}`);
        throw e;
      }
    }
    if (list.length) console.log(`  ${t}: imported ${list.length} statement(s)`);
  }
  // Make sure AUTOINCREMENT continues *after* the largest imported id.
  for (const t of insertOrder) {
    if (!byTable.has(t)) continue;
    const max = db.prepare(`SELECT COALESCE(MAX(id), 0) AS m FROM "${t}"`).get().m;
    db.prepare('INSERT OR REPLACE INTO sqlite_sequence (name, seq) VALUES (?, ?)').run(t, max);
  }
  db.exec('COMMIT');
  console.log('\nImport complete.');
} catch (e) {
  db.exec('ROLLBACK');
  console.error('\nRolled back. Reason:', e.message);
  process.exit(1);
}
