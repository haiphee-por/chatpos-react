class ProductError extends Error {
  constructor(message, code = 'PRODUCT_ERROR', statusCode = 400) {
    super(message);
    this.name = 'ProductError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

const productColumns = `
  id, "storeId", name, description, price, cost, stock, category, image, sku,
  unit, "isActive", "trackStock", "archivedAt", "createdAt", "updatedAt"
`;

function optionalText(value, field, maxLength, fallback = null) {
  if (value === undefined) return fallback;
  if (value === null) return null;
  const text = String(value).trim();
  if (text.length > maxLength) throw new ProductError(`${field} ยาวเกิน ${maxLength} ตัวอักษร`, 'PRODUCT_VALIDATION_FAILED', 422);
  return text || null;
}

function numericValue(value, field, fallback = 0) {
  const number = value === undefined || value === null || value === '' ? fallback : Number(value);
  if (!Number.isFinite(number) || number < 0) throw new ProductError(`${field} ต้องเป็นจำนวนตั้งแต่ 0 ขึ้นไป`, 'PRODUCT_VALIDATION_FAILED', 422);
  return number;
}

function normalizeProduct(input, current = null) {
  const name = optionalText(input.name, 'ชื่อสินค้า', 255, current?.name || null);
  if (!name) throw new ProductError('กรุณาระบุชื่อสินค้า', 'PRODUCT_VALIDATION_FAILED', 422);
  const image = optionalText(input.image, 'URL รูปภาพ', 2_048, current?.image || null);
  if (image?.startsWith('data:')) throw new ProductError('รูปภาพต้องเป็น URL ที่ระบบเข้าถึงได้', 'PRODUCT_VALIDATION_FAILED', 422);
  const unit = optionalText(input.unit, 'หน่วยสินค้า', 30, current?.unit || 'ชิ้น');
  if (!unit) throw new ProductError('กรุณาระบุหน่วยสินค้า', 'PRODUCT_VALIDATION_FAILED', 422);

  return {
    name,
    description: optionalText(input.description, 'คำอธิบาย', 2_000, current?.description || null),
    price: numericValue(input.price, 'ราคาขาย', current ? Number(current.price) : 0),
    cost: numericValue(input.cost, 'ต้นทุน', current ? Number(current.cost) : 0),
    stock: numericValue(input.stock, 'สต็อก', current ? Number(current.stock) : 0),
    category: optionalText(input.category, 'หมวดหมู่', 100, current?.category || null),
    image,
    sku: optionalText(input.sku, 'SKU', 100, current?.sku || null),
    unit,
    isActive: input.isActive === undefined ? current?.isActive !== false : input.isActive === true,
    trackStock: input.trackStock === undefined ? current?.trackStock === true : input.trackStock === true,
  };
}

function throwSkuConflict(error) {
  if (error?.code === '23505' && error?.constraint === 'product_store_sku_active_uidx') {
    throw new ProductError('SKU นี้ถูกใช้ในร้านแล้ว', 'PRODUCT_SKU_CONFLICT', 409);
  }
  throw error;
}

async function listProducts({ pool, storeId, includeArchived = false, limit = 100 }) {
  const result = await pool.query(`
    SELECT ${productColumns}
    FROM "Product"
    WHERE "storeId" = $1 AND ($2::boolean OR "archivedAt" IS NULL)
    ORDER BY "createdAt" DESC
    LIMIT $3
  `, [storeId, includeArchived, Math.min(Math.max(Number(limit) || 100, 1), 5_000)]);
  return result.rows;
}

async function createProduct({ pool, storeId, input }) {
  const product = normalizeProduct(input);
  try {
    const result = await pool.query(`
      INSERT INTO "Product" ("storeId", name, description, price, cost, stock, category, image, sku, unit, "isActive", "trackStock", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
      RETURNING ${productColumns}
    `, [storeId, product.name, product.description, product.price, product.cost, product.stock, product.category, product.image, product.sku, product.unit, product.isActive, product.trackStock]);
    return result.rows[0];
  } catch (error) {
    throwSkuConflict(error);
  }
}

async function getOwnedProduct(poolOrClient, storeId, productId) {
  const result = await poolOrClient.query(`SELECT ${productColumns} FROM "Product" WHERE id = $1 AND "storeId" = $2 LIMIT 1`, [productId, storeId]);
  if (!result.rows[0]) throw new ProductError('ไม่พบสินค้าในร้านนี้', 'PRODUCT_NOT_FOUND', 404);
  return result.rows[0];
}

async function updateProduct({ pool, storeId, productId, input }) {
  const current = await getOwnedProduct(pool, storeId, productId);
  if (current.archivedAt) throw new ProductError('สินค้านี้ถูกเก็บถาวรแล้ว', 'PRODUCT_ARCHIVED', 409);
  if (input.expectedUpdatedAt && new Date(input.expectedUpdatedAt).getTime() !== new Date(current.updatedAt).getTime()) {
    throw new ProductError('ข้อมูลสินค้าถูกแก้ไขแล้ว กรุณาโหลดใหม่', 'PRODUCT_VERSION_CONFLICT', 409);
  }
  const product = normalizeProduct(input, current);
  try {
    const result = await pool.query(`
      UPDATE "Product"
      SET name = $1, description = $2, price = $3, cost = $4, stock = $5, category = $6,
          image = $7, sku = $8, unit = $9, "isActive" = $10, "trackStock" = $11, "updatedAt" = NOW()
      WHERE id = $12 AND "storeId" = $13 AND ($14::timestamptz IS NULL OR "updatedAt" = $14::timestamptz)
      RETURNING ${productColumns}
    `, [product.name, product.description, product.price, product.cost, product.stock, product.category, product.image, product.sku, product.unit, product.isActive, product.trackStock, productId, storeId, input.expectedUpdatedAt || null]);
    if (!result.rows[0]) throw new ProductError('ข้อมูลสินค้าถูกแก้ไขแล้ว กรุณาโหลดใหม่', 'PRODUCT_VERSION_CONFLICT', 409);
    return { current, product: result.rows[0] };
  } catch (error) {
    if (error instanceof ProductError) throw error;
    throwSkuConflict(error);
  }
}

async function archiveProduct({ pool, storeId, productId }) {
  const current = await getOwnedProduct(pool, storeId, productId);
  if (current.archivedAt) return { current, product: current, idempotentReplay: true };
  const result = await pool.query(`
    UPDATE "Product"
    SET "isActive" = false, "archivedAt" = NOW(), "updatedAt" = NOW()
    WHERE id = $1 AND "storeId" = $2 AND "archivedAt" IS NULL
    RETURNING ${productColumns}
  `, [productId, storeId]);
  return { current, product: result.rows[0] || current, idempotentReplay: !result.rows[0] };
}

async function restoreProduct({ pool, storeId, productId }) {
  const current = await getOwnedProduct(pool, storeId, productId);
  if (!current.archivedAt) return { current, product: current, idempotentReplay: true };
  try {
    const result = await pool.query(`
      UPDATE "Product"
      SET "archivedAt" = NULL, "updatedAt" = NOW()
      WHERE id = $1 AND "storeId" = $2 AND "archivedAt" IS NOT NULL
      RETURNING ${productColumns}
    `, [productId, storeId]);
    return { current, product: result.rows[0] || current, idempotentReplay: !result.rows[0] };
  } catch (error) {
    throwSkuConflict(error);
  }
}

async function importProducts({ pool, storeId, rows }) {
  if (!Array.isArray(rows) || rows.length === 0 || rows.length > 500) {
    throw new ProductError('ไฟล์ต้องมีสินค้า 1-500 รายการ', 'PRODUCT_IMPORT_SIZE_INVALID', 422);
  }
  const products = rows.map((row, index) => {
    try {
      const product = normalizeProduct(row);
      if (!product.sku) throw new ProductError('CSV import ต้องมี SKU ทุกแถวเพื่อป้องกันข้อมูลซ้ำ', 'PRODUCT_IMPORT_SKU_REQUIRED', 422);
      return product;
    } catch (error) {
      if (error instanceof ProductError) error.message = `แถว ${index + 2}: ${error.message}`;
      throw error;
    }
  });
  const duplicateSkus = products
    .map((product) => product.sku?.toLocaleLowerCase('en-US'))
    .filter((sku, index, all) => sku && all.indexOf(sku) !== index);
  if (duplicateSkus.length) throw new ProductError(`SKU ซ้ำในไฟล์: ${duplicateSkus[0]}`, 'PRODUCT_IMPORT_DUPLICATE_SKU', 422);

  const client = await pool.connect();
  let created = 0;
  let updated = 0;
  try {
    await client.query('BEGIN');
    for (const product of products) {
      const existing = await client.query(`SELECT id FROM "Product" WHERE "storeId" = $1 AND LOWER(sku) = LOWER($2) AND "archivedAt" IS NULL LIMIT 1 FOR UPDATE`, [storeId, product.sku]);
      if (existing.rows[0]) {
        await client.query(`
          UPDATE "Product"
          SET name = $1, description = $2, price = $3, cost = $4, stock = $5, category = $6,
              image = $7, unit = $8, "isActive" = $9, "trackStock" = $10, "updatedAt" = NOW()
          WHERE id = $11 AND "storeId" = $12
        `, [product.name, product.description, product.price, product.cost, product.stock, product.category, product.image, product.unit, product.isActive, product.trackStock, existing.rows[0].id, storeId]);
        updated += 1;
      } else {
        await client.query(`
          INSERT INTO "Product" ("storeId", name, description, price, cost, stock, category, image, sku, unit, "isActive", "trackStock", "createdAt", "updatedAt")
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
        `, [storeId, product.name, product.description, product.price, product.cost, product.stock, product.category, product.image, product.sku, product.unit, product.isActive, product.trackStock]);
        created += 1;
      }
    }
    await client.query('COMMIT');
    return { created, updated, total: products.length };
  } catch (error) {
    await client.query('ROLLBACK');
    throwSkuConflict(error);
  } finally {
    client.release();
  }
}

module.exports = {
  ProductError,
  archiveProduct,
  createProduct,
  importProducts,
  listProducts,
  restoreProduct,
  updateProduct,
};