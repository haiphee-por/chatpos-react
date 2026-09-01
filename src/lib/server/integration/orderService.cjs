const crypto = require('crypto');

class OrderError extends Error {
  constructor(message, code, statusCode = 400) {
    super(message);
    this.name = 'OrderError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

const orderTransitions = {
  NEW: new Set(['ACCEPTED', 'CANCELLED']),
  ACCEPTED: new Set(['KITCHEN_RECEIVED', 'CANCELLED']),
  KITCHEN_RECEIVED: new Set(['DONE', 'CANCELLED']),
  DONE: new Set(),
  CANCELLED: new Set(),
};

function text(value, maxLength) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized ? normalized.slice(0, maxLength) : null;
}

function normalizeOrderStatus(value) {
  const normalized = String(value || '').trim().toUpperCase();
  return Object.prototype.hasOwnProperty.call(orderTransitions, normalized) ? normalized : null;
}

function normalizeTableStatus(value) {
  const normalized = String(value || '').trim().toUpperCase();
  return ['ACTIVE', 'INACTIVE'].includes(normalized) ? normalized : null;
}

function mapOrderRows(rows) {
  const orders = new Map();
  for (const row of rows) {
    if (!orders.has(row.id)) {
      orders.set(row.id, {
        id: row.id,
        storeId: row.storeId,
        tableId: row.tableId,
        tableName: row.tableName,
        orderNumber: row.orderNumber,
        status: row.status,
        source: row.source,
        customerName: row.customerName,
        note: row.note,
        total: row.total,
        currency: row.currency,
        version: row.version,
        inventoryCommitted: row.inventoryCommitted,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        items: [],
      });
    }
    if (row.itemId) {
      orders.get(row.id).items.push({
        id: row.itemId,
        productId: row.productId,
        name: row.nameSnapshot,
        price: row.priceSnapshot,
        quantity: row.quantity,
        lineTotal: row.lineTotal,
        note: row.itemNote,
        position: row.position,
      });
    }
  }
  return [...orders.values()];
}

async function getOrder({ pool, storeId, orderId }) {
  const result = await pool.query(`
    SELECT o.id, o."storeId", o."tableId", t.name AS "tableName", o."orderNumber", o.status, o.source,
      o."customerName", o.note, o.total, o.currency, o.version, o."inventoryCommitted", o."createdAt", o."updatedAt",
      i.id AS "itemId", i."productId", i."nameSnapshot", i."priceSnapshot", i.quantity, i."lineTotal",
      i.note AS "itemNote", i.position
    FROM merchant_orders o
    LEFT JOIN restaurant_tables t ON t.id = o."tableId"
    LEFT JOIN merchant_order_items i ON i."orderId" = o.id
    WHERE o."storeId" = $1 AND o.id = $2
    ORDER BY i.position, i."createdAt"`, [storeId, orderId]);
  return mapOrderRows(result.rows)[0] || null;
}

async function listTables({ pool, storeId, includeInactive = false }) {
  const result = await pool.query(`
    SELECT t.id, t."storeId", t.name, t.zone, t.token, t.status, t.version, t."createdAt", t."updatedAt",
      COUNT(o.id) FILTER (WHERE o.status NOT IN ('DONE', 'CANCELLED'))::integer AS "openOrderCount",
      COALESCE(SUM(o.total) FILTER (WHERE o.status NOT IN ('DONE', 'CANCELLED')), 0)::numeric(18,2) AS "openOrderTotal"
    FROM restaurant_tables t
    LEFT JOIN merchant_orders o ON o."tableId" = t.id
    WHERE t."storeId" = $1 AND ($2::boolean OR t.status = 'ACTIVE')
    GROUP BY t.id
    ORDER BY t."createdAt", t.name`,
  [storeId, includeInactive]);
  return result.rows;
}

async function createTable({ pool, storeId, actorId, body, idempotencyKey }) {
  const name = text(body.name, 80);
  const zone = text(body.zone, 120);
  if (!name) throw new OrderError('กรุณาระบุชื่อโต๊ะ', 'TABLE_NAME_REQUIRED', 422);
  if (!idempotencyKey || idempotencyKey.length > 200) throw new OrderError('Idempotency-Key is required', 'IDEMPOTENCY_KEY_REQUIRED', 400);
  const existing = await pool.query('SELECT * FROM restaurant_tables WHERE "storeId" = $1 AND "idempotencyKey" = $2 LIMIT 1', [storeId, idempotencyKey]);
  if (existing.rowCount) return { table: existing.rows[0], idempotentReplay: true };
  try {
    const result = await pool.query(`
      INSERT INTO restaurant_tables ("storeId", name, zone, "idempotencyKey", "createdBy")
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *`, [storeId, name, zone, idempotencyKey, actorId]);
    return { table: result.rows[0], idempotentReplay: false };
  } catch (error) {
    if (error.code === '23505') throw new OrderError('ชื่อโต๊ะนี้มีอยู่แล้ว', 'TABLE_NAME_CONFLICT', 409);
    throw error;
  }
}

async function updateTable({ pool, storeId, tableId, body }) {
  const currentResult = await pool.query('SELECT * FROM restaurant_tables WHERE id = $1 AND "storeId" = $2 LIMIT 1', [tableId, storeId]);
  if (!currentResult.rowCount) throw new OrderError('ไม่พบโต๊ะในร้านนี้', 'TABLE_NOT_FOUND', 404);
  const current = currentResult.rows[0];
  const expectedVersion = Number(body.expectedVersion);
  if (!Number.isInteger(expectedVersion) || expectedVersion !== current.version) throw new OrderError('ข้อมูลโต๊ะถูกแก้ไขแล้ว กรุณาโหลดใหม่', 'TABLE_VERSION_CONFLICT', 409);
  const name = body.name === undefined ? current.name : text(body.name, 80);
  const zone = body.zone === undefined ? current.zone : text(body.zone, 120);
  const status = body.status === undefined ? current.status : normalizeTableStatus(body.status);
  if (!name || !status) throw new OrderError('ข้อมูลโต๊ะไม่ถูกต้อง', 'TABLE_VALIDATION_FAILED', 422);
  if (status === 'INACTIVE') {
    const openOrders = await pool.query("SELECT 1 FROM merchant_orders WHERE \"tableId\" = $1 AND status NOT IN ('DONE', 'CANCELLED') LIMIT 1", [tableId]);
    if (openOrders.rowCount) throw new OrderError('ปิดโต๊ะที่ยังมีออเดอร์ไม่ได้', 'TABLE_HAS_OPEN_ORDERS', 409);
  }
  try {
    const result = await pool.query(`
      UPDATE restaurant_tables SET name = $1, zone = $2, status = $3, version = version + 1, "updatedAt" = NOW()
      WHERE id = $4 AND "storeId" = $5 AND version = $6
      RETURNING *`, [name, zone, status, tableId, storeId, expectedVersion]);
    if (!result.rowCount) throw new OrderError('ข้อมูลโต๊ะถูกแก้ไขแล้ว กรุณาโหลดใหม่', 'TABLE_VERSION_CONFLICT', 409);
    return result.rows[0];
  } catch (error) {
    if (error.code === '23505') throw new OrderError('ชื่อโต๊ะนี้มีอยู่แล้ว', 'TABLE_NAME_CONFLICT', 409);
    throw error;
  }
}

async function listOrders({ pool, storeId, status, limit = 100 }) {
  const values = [storeId];
  let statusClause = '';
  if (status) {
    const normalizedStatus = normalizeOrderStatus(status);
    if (!normalizedStatus) throw new OrderError('สถานะออเดอร์ไม่ถูกต้อง', 'ORDER_STATUS_INVALID', 422);
    values.push(normalizedStatus);
    statusClause = `AND o.status = $${values.length}`;
  }
  values.push(Math.min(200, Math.max(1, Number(limit) || 100)));
  const result = await pool.query(`
    WITH selected_orders AS (
      SELECT o.id
      FROM merchant_orders o
      WHERE o."storeId" = $1 ${statusClause}
      ORDER BY o."createdAt" DESC
      LIMIT $${values.length}
    )
    SELECT o.id, o."storeId", o."tableId", t.name AS "tableName", o."orderNumber", o.status, o.source,
      o."customerName", o.note, o.total, o.currency, o.version, o."inventoryCommitted", o."createdAt", o."updatedAt",
      i.id AS "itemId", i."productId", i."nameSnapshot", i."priceSnapshot", i.quantity, i."lineTotal",
      i.note AS "itemNote", i.position
    FROM selected_orders selected
    JOIN merchant_orders o ON o.id = selected.id
    LEFT JOIN restaurant_tables t ON t.id = o."tableId"
    LEFT JOIN merchant_order_items i ON i."orderId" = o.id
    ORDER BY o."createdAt" DESC, i.position, i."createdAt"`, values);
  return mapOrderRows(result.rows);
}

async function createOrder({ pool, storeId, actorId, actorRole, body, idempotencyKey, requestId }) {
  if (!idempotencyKey || idempotencyKey.length > 200) throw new OrderError('Idempotency-Key is required', 'IDEMPOTENCY_KEY_REQUIRED', 400);
  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 100) throw new OrderError('ออเดอร์ต้องมีสินค้า 1-100 รายการ', 'ORDER_ITEMS_INVALID', 422);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const replay = await client.query('SELECT id FROM merchant_orders WHERE "storeId" = $1 AND "idempotencyKey" = $2 LIMIT 1', [storeId, idempotencyKey]);
    if (replay.rowCount) {
      const order = await getOrder({ pool: client, storeId, orderId: replay.rows[0].id });
      await client.query('COMMIT');
      return { order, idempotentReplay: true };
    }
    const tableId = text(body.tableId, 100);
    if (tableId) {
      const tableResult = await client.query("SELECT id FROM restaurant_tables WHERE id = $1 AND \"storeId\" = $2 AND status = 'ACTIVE' LIMIT 1", [tableId, storeId]);
      if (!tableResult.rowCount) throw new OrderError('ไม่พบโต๊ะที่เปิดใช้งานในร้านนี้', 'TABLE_NOT_FOUND', 404);
    }
    const itemInputs = body.items.map((item, position) => {
      const productId = text(item.productId, 100);
      const quantity = Number(item.quantity);
      if (!productId || !Number.isInteger(quantity) || quantity < 1 || quantity > 999) throw new OrderError(`สินค้าแถว ${position + 1} ไม่ถูกต้อง`, 'ORDER_ITEM_INVALID', 422);
      return { productId, quantity, note: text(item.note, 500), position };
    });
    const productIds = [...new Set(itemInputs.map((item) => item.productId))];
    const productsResult = await client.query(`
      SELECT id, name, price, stock, "trackStock", "isActive"
      FROM "Product" WHERE "storeId" = $1 AND id = ANY($2::uuid[])
      FOR UPDATE`, [storeId, productIds]);
    if (productsResult.rowCount !== productIds.length) throw new OrderError('มีสินค้าที่ไม่อยู่ในร้านนี้', 'ORDER_PRODUCT_NOT_FOUND', 404);
    const products = new Map(productsResult.rows.map((product) => [product.id, product]));
    const requestedQuantityByProduct = itemInputs.reduce((quantities, item) => quantities.set(item.productId, (quantities.get(item.productId) || 0) + item.quantity), new Map());
    for (const [productId, requestedQuantity] of requestedQuantityByProduct) {
      const product = products.get(productId);
      if (product.trackStock && Number(product.stock) < requestedQuantity) throw new OrderError(`${product.name} มีสต็อกไม่พอ`, 'ORDER_STOCK_INSUFFICIENT', 409);
    }
    let total = 0;
    const lines = itemInputs.map((item) => {
      const product = products.get(item.productId);
      if (!product.isActive) throw new OrderError(`${product.name} ปิดขายอยู่`, 'ORDER_PRODUCT_INACTIVE', 409);
      const price = Number(product.price);
      const lineTotal = Number((price * item.quantity).toFixed(2));
      total += lineTotal;
      return { ...item, name: product.name, price, lineTotal };
    });
    total = Number(total.toFixed(2));
    const orderId = crypto.randomUUID();
    const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
    const source = ['POS', 'TABLE', 'DELIVERY', 'TAKEAWAY'].includes(String(body.source || '').toUpperCase()) ? String(body.source).toUpperCase() : 'POS';
    await client.query(`
      INSERT INTO merchant_orders (id, "storeId", "tableId", "orderNumber", status, source, "customerName", note, total, "idempotencyKey", "createdBy")
      VALUES ($1, $2, $3, $4, 'NEW', $5, $6, $7, $8, $9, $10)`,
    [orderId, storeId, tableId, orderNumber, source, text(body.customerName, 160), text(body.note, 1000), total, idempotencyKey, actorId]);
    for (const line of lines) {
      await client.query(`
        INSERT INTO merchant_order_items ("orderId", "productId", "nameSnapshot", "priceSnapshot", quantity, "lineTotal", note, position)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [orderId, line.productId, line.name, line.price, line.quantity, line.lineTotal, line.note, line.position]);
    }
    await client.query(`
      INSERT INTO merchant_order_status_events ("orderId", "fromStatus", "toStatus", "actorId", "actorRole", "requestId")
      VALUES ($1, NULL, 'NEW', $2, $3, $4)`, [orderId, actorId, actorRole, requestId || null]);
    const order = await getOrder({ pool: client, storeId, orderId });
    await client.query('COMMIT');
    return { order, idempotentReplay: false };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function transitionOrder({ pool, storeId, orderId, actorId, actorRole, body, requestId }) {
  const nextStatus = normalizeOrderStatus(body.status);
  const expectedVersion = Number(body.expectedVersion);
  if (!nextStatus || !Number.isInteger(expectedVersion)) throw new OrderError('สถานะหรือ version ไม่ถูกต้อง', 'ORDER_TRANSITION_INVALID', 422);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const currentResult = await client.query('SELECT * FROM merchant_orders WHERE id = $1 AND "storeId" = $2 FOR UPDATE', [orderId, storeId]);
    if (!currentResult.rowCount) throw new OrderError('ไม่พบออเดอร์ในร้านนี้', 'ORDER_NOT_FOUND', 404);
    const current = currentResult.rows[0];
    if (current.version !== expectedVersion) throw new OrderError('ออเดอร์ถูกอัปเดตแล้ว กรุณาโหลดใหม่', 'ORDER_VERSION_CONFLICT', 409);
    if (!orderTransitions[current.status]?.has(nextStatus)) throw new OrderError(`เปลี่ยนสถานะจาก ${current.status} เป็น ${nextStatus} ไม่ได้`, 'ORDER_STATUS_TRANSITION_INVALID', 409);
    if (nextStatus === 'DONE' && !current.inventoryCommitted) {
      await client.query(`
        SELECT p.id
        FROM "Product" p
        WHERE p."storeId" = $2 AND p.id IN (
          SELECT i."productId" FROM merchant_order_items i WHERE i."orderId" = $1 AND i."productId" IS NOT NULL
        )
        FOR UPDATE`, [orderId, storeId]);
      const lines = await client.query(`
        SELECT i."productId", SUM(i.quantity)::integer AS quantity, p.name, p.stock, p."trackStock"
        FROM merchant_order_items i
        JOIN "Product" p ON p.id = i."productId" AND p."storeId" = $2
        WHERE i."orderId" = $1
        GROUP BY i."productId", p.id`, [orderId, storeId]);
      for (const line of lines.rows) {
        if (!line.productId || !line.trackStock) continue;
        if (Number(line.stock) < line.quantity) throw new OrderError(`${line.name} มีสต็อกไม่พอสำหรับปิดออเดอร์`, 'ORDER_STOCK_INSUFFICIENT', 409);
        await client.query('UPDATE "Product" SET stock = stock - $1, "updatedAt" = NOW() WHERE id = $2 AND "storeId" = $3', [line.quantity, line.productId, storeId]);
      }
    }
    const result = await client.query(`
      UPDATE merchant_orders
      SET status = $1, version = version + 1, "inventoryCommitted" = CASE WHEN $1 = 'DONE' THEN true ELSE "inventoryCommitted" END, "updatedAt" = NOW()
      WHERE id = $2 AND "storeId" = $3 AND version = $4
      RETURNING *`, [nextStatus, orderId, storeId, expectedVersion]);
    if (!result.rowCount) throw new OrderError('ออเดอร์ถูกอัปเดตแล้ว กรุณาโหลดใหม่', 'ORDER_VERSION_CONFLICT', 409);
    await client.query(`
      INSERT INTO merchant_order_status_events ("orderId", "fromStatus", "toStatus", reason, "actorId", "actorRole", "requestId")
      VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [orderId, current.status, nextStatus, text(body.reason, 1000), actorId, actorRole, requestId || null]);
    const order = await getOrder({ pool: client, storeId, orderId });
    await client.query('COMMIT');
    return order;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  OrderError,
  createOrder,
  createTable,
  listOrders,
  listTables,
  transitionOrder,
  updateTable,
};
