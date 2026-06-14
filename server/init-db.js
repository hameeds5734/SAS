// Creates the SQLite schema if it doesn't yet exist. Idempotent — safe to run on every boot.
// Called by db.js when the database connection is opened.

module.exports = function initDb(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS base_products (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT    NOT NULL UNIQUE,
      created_at TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS places (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT    NOT NULL UNIQUE,
      created_at TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS customers (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT    NOT NULL,
      place_id   INTEGER,
      phone      TEXT,
      created_at TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (place_id) REFERENCES places(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS products (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      base_product_id INTEGER,
      base_product    TEXT    NOT NULL DEFAULT '',
      sub_product     TEXT,
      price           REAL    DEFAULT 0,
      created_at      TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS bills (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      bill_date    TEXT    NOT NULL,
      customer_id  INTEGER NOT NULL,
      total_amount REAL    DEFAULT 0,
      paid_amount  REAL    DEFAULT 0,
      balance      REAL    DEFAULT 0,
      notes        TEXT,
      created_at   TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    );

    CREATE TABLE IF NOT EXISTS bill_items (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      bill_id      INTEGER NOT NULL,
      product_id   INTEGER,
      product_name TEXT    NOT NULL DEFAULT '',
      quantity     REAL    DEFAULT 1,
      rate         REAL    DEFAULT 0,
      amount       REAL    DEFAULT 0,
      FOREIGN KEY (bill_id)    REFERENCES bills(id)    ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS payments (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id  INTEGER NOT NULL,
      amount       REAL    NOT NULL,
      payment_date TEXT    NOT NULL,
      notes        TEXT,
      created_at   TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    );

    CREATE INDEX IF NOT EXISTS idx_customers_place      ON customers(place_id);
    CREATE INDEX IF NOT EXISTS idx_bills_customer       ON bills(customer_id);
    CREATE INDEX IF NOT EXISTS idx_bills_date           ON bills(bill_date);
    CREATE INDEX IF NOT EXISTS idx_bill_items_bill      ON bill_items(bill_id);
    CREATE INDEX IF NOT EXISTS idx_bill_items_product   ON bill_items(product_id);
    CREATE INDEX IF NOT EXISTS idx_payments_customer    ON payments(customer_id);
    CREATE INDEX IF NOT EXISTS idx_payments_date        ON payments(payment_date);
  `);
};
