// Runs every .sql file in server/migrations/ in alphabetical order.
// Already-applied steps (duplicate columns, missing tables on rollback) are reported and skipped.
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function run() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'sas_accounts',
    multipleStatements: true,
  });

  const dir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
  for (const file of files) {
    console.log(`\n→ Running ${file}`);
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    // Split on `;` at end-of-line, drop comments and blanks
    const statements = sql
      .split(/;\s*\n/)
      .map(s => s.replace(/^\s*--.*$/gm, '').trim())
      .filter(s => s.length > 0);

    for (const stmt of statements) {
      try {
        await conn.query(stmt);
        console.log('  ✓', stmt.split('\n')[0].slice(0, 80));
      } catch (err) {
        // tolerate re-runs: column/table exists, key exists, etc.
        const benign = ['ER_DUP_FIELDNAME', 'ER_DUP_KEYNAME', 'ER_TABLE_EXISTS_ERROR', 'ER_FK_DUP_NAME', 'ER_CANT_DROP_FIELD_OR_KEY', 'ER_DUP_ENTRY'];
        if (benign.includes(err.code)) {
          console.log('  · skip (already applied):', stmt.split('\n')[0].slice(0, 80));
        } else {
          console.error('  ✗', err.code, err.message);
          console.error('  Statement:', stmt);
          await conn.end();
          process.exit(1);
        }
      }
    }
  }

  await conn.end();
  console.log('\nMigrations complete.');
}

run().catch(err => { console.error(err); process.exit(1); });
