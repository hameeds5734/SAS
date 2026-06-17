const express = require('express');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const dbModule = require('../db');

const router = express.Router();

// Electron sets SAS_BACKUP_DIR to a writable user folder; otherwise default to ../backups.
const BACKUP_DIR = process.env.SAS_BACKUP_DIR || path.join(__dirname, '..', 'backups');
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

const stamp = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
};

// Count rows in the user-data tables — used to verify a backup is complete.
const TABLES = ['places', 'base_products', 'customers', 'products', 'bills', 'bill_items', 'payments'];
function counts(db) {
  const out = {};
  for (const t of TABLES) {
    try { out[t] = db.prepare(`SELECT COUNT(*) AS c FROM "${t}"`).get().c; }
    catch (_) { out[t] = 0; }
  }
  return out;
}

// Create a backup of the live DB into ./server/backups.
// We checkpoint the WAL first so the .db file is up-to-date, then VACUUM INTO writes
// a complete consistent copy. The live DB is never modified.
router.post('/backup', async (_req, res) => {
  try {
    const filename = `sas-backup-${stamp()}.db`;
    const filepath = path.join(BACKUP_DIR, filename);

    const live = dbModule.getDb();
    try { live.pragma('wal_checkpoint(TRUNCATE)'); } catch (_) {}

    // VACUUM INTO can't take a parameter binding, so the path is interpolated and quoted.
    const safe = filepath.replace(/'/g, "''");
    live.exec(`VACUUM INTO '${safe}'`);

    // Verify the backup actually has the same rows as the live DB.
    const liveCounts = counts(live);
    const check = new Database(filepath, { readonly: true });
    const backupCounts = counts(check);
    check.close();

    const mismatched = TABLES.filter(t => liveCounts[t] !== backupCounts[t]);
    const stats = fs.statSync(filepath);
    res.json({
      success: true,
      filename,
      path: filepath,
      size: stats.size,
      counts: backupCounts,
      verified: mismatched.length === 0,
      mismatched,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List existing backup files (most recent first).
router.get('/backups', (_req, res) => {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.endsWith('.db'))
      .map(f => {
        const fp = path.join(BACKUP_DIR, f);
        const st = fs.statSync(fp);
        return { filename: f, size: st.size, mtime: st.mtime };
      })
      .sort((a, b) => new Date(b.mtime) - new Date(a.mtime));
    res.json(files);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Inspect (without restoring) — returns row counts of the uploaded file so the UI
// can show "you are about to replace X bills with Y bills" before touching anything.
router.post(
  '/preview-restore',
  express.raw({ type: 'application/octet-stream', limit: '200mb' }),
  async (req, res) => {
    try {
      const buf = req.body;
      if (!buf || buf.length === 0) return res.status(400).json({ error: 'Empty body' });

      const tmpPath = path.join(BACKUP_DIR, `_preview-${Date.now()}.tmp.db`);
      fs.writeFileSync(tmpPath, buf);
      try {
        const test = new Database(tmpPath, { readonly: true });
        const row = test.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='bills' LIMIT 1`).get();
        if (!row) throw new Error('Missing expected tables');
        const incoming = counts(test);
        test.close();
        const current = counts(dbModule.getDb());
        res.json({ success: true, current, incoming, _tmp: path.basename(tmpPath) });
      } catch (e) {
        try { fs.unlinkSync(tmpPath); } catch (_) {}
        return res.status(400).json({ error: 'Invalid backup file: ' + e.message });
      }
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// Restore: the request body is the raw .db file bytes.
// We validate, take a safety snapshot of the current DB, then swap files and reopen.
router.post(
  '/restore',
  express.raw({ type: 'application/octet-stream', limit: '200mb' }),
  async (req, res) => {
    try {
      const buf = req.body;
      if (!buf || buf.length === 0) {
        return res.status(400).json({ error: 'Empty body — pick a backup file first' });
      }

      const tmpPath = path.join(BACKUP_DIR, `_restore-${Date.now()}.tmp.db`);
      fs.writeFileSync(tmpPath, buf);

      // Validate it's a real SQLite file with the expected tables.
      let incoming;
      try {
        const test = new Database(tmpPath, { readonly: true });
        const row = test.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='bills' LIMIT 1`).get();
        if (!row) throw new Error('Backup is missing expected tables (bills, ...)');
        incoming = counts(test);
        test.close();
      } catch (e) {
        try { fs.unlinkSync(tmpPath); } catch (_) {}
        return res.status(400).json({ error: 'Invalid backup file: ' + e.message });
      }

      // Safety snapshot of the current DB before overwriting (uses the same robust VACUUM INTO).
      const safety = path.join(BACKUP_DIR, `sas-pre-restore-${stamp()}.db`);
      try {
        const live = dbModule.getDb();
        try { live.pragma('wal_checkpoint(TRUNCATE)'); } catch (_) {}
        const safe = safety.replace(/'/g, "''");
        live.exec(`VACUUM INTO '${safe}'`);
      } catch (_) {}

      dbModule.closeDb();

      const dbPath = dbModule.DB_PATH;
      for (const suffix of ['', '-wal', '-shm', '-journal']) {
        try { fs.unlinkSync(dbPath + suffix); } catch (_) {}
      }
      fs.copyFileSync(tmpPath, dbPath);
      try { fs.unlinkSync(tmpPath); } catch (_) {}

      dbModule.reloadDb();

      res.json({
        success: true,
        preRestoreBackup: path.basename(safety),
        restored: incoming,
      });
    } catch (err) {
      try { dbModule.reloadDb(); } catch (_) {}
      res.status(500).json({ error: err.message });
    }
  }
);

module.exports = router;
