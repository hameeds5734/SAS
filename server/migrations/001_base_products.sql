-- Migration: introduce base_products table, link products to it, enforce uniqueness.
-- Run once against the sas_accounts database.

-- 1) Unique place names
ALTER TABLE places
  ADD UNIQUE KEY uniq_places_name (name);

-- 2) Create base_products
CREATE TABLE IF NOT EXISTS base_products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_base_products_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3) Backfill from existing products.base_product text column
INSERT IGNORE INTO base_products (name)
  SELECT DISTINCT TRIM(base_product)
  FROM products
  WHERE base_product IS NOT NULL AND TRIM(base_product) <> '';

-- 4) Add base_product_id column and backfill
ALTER TABLE products
  ADD COLUMN base_product_id INT NULL AFTER id;

UPDATE products p
  JOIN base_products bp ON LOWER(TRIM(p.base_product)) = LOWER(bp.name)
  SET p.base_product_id = bp.id;

ALTER TABLE products
  MODIFY COLUMN base_product_id INT NOT NULL,
  ADD CONSTRAINT fk_products_base FOREIGN KEY (base_product_id) REFERENCES base_products(id);

-- 5) Remove the old text column
ALTER TABLE products
  DROP COLUMN base_product;

-- 6) Unique (base_product_id, sub_product) pair
-- Note: MySQL treats NULLs as distinct in UNIQUE indexes, so app-level checks
-- additionally guard against duplicate variants where sub_product is NULL.
ALTER TABLE products
  ADD UNIQUE KEY uniq_products_base_sub (base_product_id, sub_product);
