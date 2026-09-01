CREATE TABLE IF NOT EXISTS restaurant_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "storeId" uuid NOT NULL REFERENCES "Store"(id) ON DELETE CASCADE,
  name text NOT NULL,
  zone text,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(18), 'hex'),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  "idempotencyKey" text,
  "createdBy" uuid REFERENCES "User"(id),
  "createdAt" timestamptz NOT NULL DEFAULT NOW(),
  "updatedAt" timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE ("storeId", "idempotencyKey")
);

CREATE UNIQUE INDEX IF NOT EXISTS restaurant_tables_store_name_active_uq
  ON restaurant_tables ("storeId", LOWER(name))
  WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS restaurant_tables_store_status_idx
  ON restaurant_tables ("storeId", status, "createdAt");

CREATE TABLE IF NOT EXISTS merchant_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "storeId" uuid NOT NULL REFERENCES "Store"(id) ON DELETE RESTRICT,
  "tableId" uuid REFERENCES restaurant_tables(id) ON DELETE SET NULL,
  "orderNumber" text NOT NULL,
  status text NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW', 'ACCEPTED', 'KITCHEN_RECEIVED', 'DONE', 'CANCELLED')),
  source text NOT NULL DEFAULT 'POS' CHECK (source IN ('POS', 'TABLE', 'DELIVERY', 'TAKEAWAY')),
  "customerName" text,
  note text,
  total numeric(18,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  currency text NOT NULL DEFAULT 'THB',
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  "idempotencyKey" text NOT NULL,
  "inventoryCommitted" boolean NOT NULL DEFAULT false,
  "createdBy" uuid REFERENCES "User"(id),
  "createdAt" timestamptz NOT NULL DEFAULT NOW(),
  "updatedAt" timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE ("storeId", "orderNumber"),
  UNIQUE ("storeId", "idempotencyKey")
);

CREATE INDEX IF NOT EXISTS merchant_orders_store_status_idx
  ON merchant_orders ("storeId", status, "createdAt" DESC);
CREATE INDEX IF NOT EXISTS merchant_orders_table_status_idx
  ON merchant_orders ("tableId", status, "createdAt" DESC);

CREATE TABLE IF NOT EXISTS merchant_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "orderId" uuid NOT NULL REFERENCES merchant_orders(id) ON DELETE CASCADE,
  "productId" uuid REFERENCES "Product"(id) ON DELETE SET NULL,
  "nameSnapshot" text NOT NULL,
  "priceSnapshot" numeric(18,2) NOT NULL CHECK ("priceSnapshot" >= 0),
  quantity integer NOT NULL CHECK (quantity > 0 AND quantity <= 999),
  "lineTotal" numeric(18,2) NOT NULL CHECK ("lineTotal" >= 0),
  note text,
  position integer NOT NULL DEFAULT 0,
  "createdAt" timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS merchant_order_items_order_idx
  ON merchant_order_items ("orderId", position, "createdAt");

CREATE TABLE IF NOT EXISTS merchant_order_status_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "orderId" uuid NOT NULL REFERENCES merchant_orders(id) ON DELETE CASCADE,
  "fromStatus" text,
  "toStatus" text NOT NULL,
  reason text,
  "actorId" uuid REFERENCES "User"(id),
  "actorRole" text NOT NULL,
  "requestId" text,
  "createdAt" timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS merchant_order_status_events_order_idx
  ON merchant_order_status_events ("orderId", "createdAt" DESC);
