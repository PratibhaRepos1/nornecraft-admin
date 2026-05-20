-- Norne Craft — categories table (additive)
-- Safe to run on your existing DB. Does NOT touch the existing `products` table.
-- Your `products.category` stays as a VARCHAR holding the category name.

-- -----------------------------------------------------
-- categories
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name         VARCHAR(120) NOT NULL,
  slug         VARCHAR(140) NULL,
  description  TEXT         NULL,
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
                            ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_categories_name (name),
  UNIQUE KEY uq_categories_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Seed categories from the distinct values currently in products.
-- Run this once so the dropdown is pre-populated with what you already have
-- (Drinking Horns, Eating Wood, Drinking Glass, etc.).
-- -----------------------------------------------------
INSERT IGNORE INTO categories (name, slug)
SELECT
  TRIM(category) AS name,
  LOWER(REPLACE(REPLACE(TRIM(category), ' ', '-'), '_', '-')) AS slug
FROM products
WHERE category IS NOT NULL AND TRIM(category) <> ''
GROUP BY TRIM(category);

-- -----------------------------------------------------
-- OPTIONAL — only if you later want a real FK between products and categories.
-- Leave this commented unless you also update the API to write category_id.
-- -----------------------------------------------------
-- ALTER TABLE products
--   ADD COLUMN category_id INT UNSIGNED NULL AFTER category,
--   ADD KEY idx_products_category_id (category_id),
--   ADD CONSTRAINT fk_products_category
--     FOREIGN KEY (category_id) REFERENCES categories (id)
--     ON DELETE SET NULL
--     ON UPDATE CASCADE;
--
-- UPDATE products p
--   JOIN categories c ON c.name = p.category
--   SET p.category_id = c.id;
