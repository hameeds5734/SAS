// SQLite-backed connection exposing the same surface (`execute`, `getConnection`,
// `beginTransaction`/`commit`/`rollback`/`release`) that the routes used to call on
// `mysql2/promise`. Existing route files keep working without changes.
//
// Also exposes `getDb()`, `closeDb()`, `reloadDb()` so the admin route can swap the
// underlying file at runtime (used for restore).
//
// DB file lives next to server.js as `sas_accounts.db`. Override with SAS_DB_PATH.

const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = process.env.SAS_DB_PATH || path.join(__dirname, 'sas_accounts.db');

let db = null;

function openDb() {
  const instance = new Database(DB_PATH);
  instance.pragma('journal_mode = WAL');
  instance.pragma('foreign_keys = ON');

  // MySQL-style helpers our queries call.
  instance.function('DATE_FORMAT', (date, fmt) => {
    if (date == null) return null;
    const s = String(date);
    if (fmt === '%Y-%m-%d') return s.length >= 10 ? s.substring(0, 10) : s;
    return s;
  });

  instance.function('SUBSTRING_INDEX', (str, delim, count) => {
    if (str == null) return null;
    const s = String(str);
    const d = String(delim || '');
    const c = Number(count) || 0;
    if (!d || c === 0) return '';
    if (c > 0) {
      let pos = 0;
      for (let i = 0; i < c; i++) {
        const next = s.indexOf(d, pos);
        if (next < 0) return s;
        pos = next + d.length;
      }
      return s.substring(0, pos - d.length);
    }
    let end = s.length;
    for (let i = 0; i < -c; i++) {
      const next = s.lastIndexOf(d, end - 1);
      if (next < 0) return s;
      end = next;
    }
    return s.substring(end + d.length);
  });

  require('./init-db')(instance);
  return instance;
}

function getDb() {
  if (!db) db = openDb();
  return db;
}

function closeDb() {
  if (db) {
    try { db.close(); } catch (_) {}
    db = null;
  }
}

function reloadDb() {
  closeDb();
  return getDb();
}

// ---- mysql2-compatible execute / getConnection ----

const isRead = (sql) => /^\s*(SELECT|PRAGMA|EXPLAIN|WITH)\b/i.test(sql);

const sanitize = (params) =>
  (params || []).map(p => {
    if (p === undefined) return null;
    if (typeof p === 'boolean') return p ? 1 : 0;
    return p;
  });

function execute(sql, params) {
  try {
    const stmt = getDb().prepare(sql);
    const args = sanitize(params);
    if (isRead(sql)) {
      return Promise.resolve([stmt.all(...args)]);
    }
    const info = stmt.run(...args);
    return Promise.resolve([{
      insertId: Number(info.lastInsertRowid),
      affectedRows: info.changes,
    }]);
  } catch (err) {
    return Promise.reject(err);
  }
}

// SQLite holds a single writer; serialize transactions so concurrent requests
// can't interleave BEGIN/COMMIT.
let txTail = Promise.resolve();

async function getConnection() {
  const prev = txTail;
  let release;
  const lock = new Promise(r => { release = r; });
  txTail = prev.then(() => lock);
  await prev;

  let released = false;
  const doRelease = () => { if (!released) { released = true; release(); } };
  let inTx = false;

  return {
    beginTransaction: async () => { getDb().exec('BEGIN'); inTx = true; },
    commit: async () => { if (inTx) { getDb().exec('COMMIT'); inTx = false; } doRelease(); },
    rollback: async () => {
      if (inTx) { try { getDb().exec('ROLLBACK'); } catch (_) {} inTx = false; }
      doRelease();
    },
    execute,
    release: doRelease,
  };
}

module.exports = {
  execute,
  getConnection,
  getDb,
  closeDb,
  reloadDb,
  DB_PATH,
  get _db() { return getDb(); }, // back-compat for older scripts
};
