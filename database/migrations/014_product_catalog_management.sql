ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS unit text NOT NULL DEFAULT 'ชิ้น',
  ADD COLUMN IF NOT EXISTS "archivedAt" timestamptz;

CREATE INDEX IF NOT EXISTS product_store_catalog_idx
  ON "Product" ("storeId", "archivedAt", "isActive", "createdAt" DESC);

CREATE UNIQUE INDEX IF NOT EXISTS product_store_sku_active_uidx
  ON "Product" ("storeId", LOWER(sku))
  WHERE sku IS NOT NULL AND BTRIM(sku) <> '' AND "archivedAt" IS NULL;