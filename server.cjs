const http = require('http');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const QRCode = require('qrcode');

dotenv.config();

const port = process.env.API_PORT || 3001;
const configuredDatabaseName = (() => {
  if (process.env.PGDATABASE) return process.env.PGDATABASE;
  try {
    return decodeURIComponent(new URL(process.env.DATABASE_URL).pathname.replace(/^\//, '')) || 'chatpos';
  } catch {
    return 'chatpos';
  }
})();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || undefined,
  host: process.env.PGHOST || '127.0.0.1',
  port: Number(process.env.PGPORT) || 5432,
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || '',
  database: process.env.PGDATABASE || 'chatpos',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

function crc16(data) {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    let x = ((crc >> 8) ^ data.charCodeAt(i)) & 0xff;
    x ^= x >> 4;
    crc = ((crc << 8) ^ (x << 12) ^ (x << 5) ^ x) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function formatTag(id, value) {
  const len = value.length.toString().padStart(2, '0');
  return `${id}${len}${value}`;
}

function generatePromptPayPayload(target, amount) {
  const cleanTarget = (target || '0823456789').replace(/[^0-9]/g, '');
  let targetTag = '';

  if ((cleanTarget.length === 10 || cleanTarget.length === 9) && cleanTarget.startsWith('0')) {
    const formattedPhone = '0066' + cleanTarget.slice(1);
    targetTag = formatTag('01', formattedPhone);
  } else if (cleanTarget.length === 13) {
    targetTag = formatTag('02', cleanTarget);
  } else if (cleanTarget.length === 15) {
    targetTag = formatTag('03', cleanTarget);
  } else {
    const formattedPhone = cleanTarget.startsWith('0') ? '0066' + cleanTarget.slice(1) : '0066' + cleanTarget;
    targetTag = formatTag('01', formattedPhone);
  }

  const aid = formatTag('00', 'A000000677010111');
  const tag29 = formatTag('29', aid + targetTag);

  const pfi = formatTag('00', '01');
  const poi = formatTag('01', amount && Number(amount) > 0 ? '12' : '11');
  const currency = formatTag('53', '764');
  const country = formatTag('58', 'TH');

  let payload = pfi + poi + tag29 + currency;

  if (amount && Number(amount) > 0) {
    const num = Number(amount);
    const amtStr = num.toFixed(2);
    payload += formatTag('54', amtStr);
  }

  payload += country;
  payload += '6304';
  const checksum = crc16(payload);
  return payload + checksum;
}

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
};

function parseJsonBody(req) {
  return new Promise((resolve) => {
    let bodyStr = '';
    req.on('data', (chunk) => (bodyStr += chunk));
    req.on('end', () => {
      try {
        resolve(JSON.parse(bodyStr || '{}'));
      } catch (e) {
        resolve({});
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const url = req.url || '';

  // Handle API Database routes
  if (url.startsWith('/api/db') || url.startsWith('/api/v1')) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    try {
      // ── AUTH: 1. POST /api/db/auth/login ────────────────────────────
      if (url === '/api/db/auth/login' && req.method === 'POST') {
        const body = await parseJsonBody(req);
        const { email, password, role } = body;

        if (!email || !password) {
          res.statusCode = 400;
          res.end(JSON.stringify({ success: false, error: 'กรุณากรอกอีเมลและรหัสผ่าน' }));
          return;
        }

        const cleanEmail = String(email).trim().toLowerCase();

        // 1. Search in User table
        const userRes = await pool.query(
          `SELECT id, name, email, phone, password, role, "isActive", avatar, "createdAt" 
           FROM "User" 
           WHERE LOWER(email) = $1 OR phone = $2 LIMIT 1;`,
          [cleanEmail, email]
        );

        let user = userRes.rows[0];
        let isAdminAccount = false;

        // 2. If not found in User, and attempting Admin, check AdminAccount table
        if (!user && (role === 'admin' || !role)) {
          const adminRes = await pool.query(
            `SELECT id, name, email, phone, password, 'admin' as role, "isActive", avatar, "createdAt" 
             FROM "AdminAccount" 
             WHERE LOWER(email) = $1 LIMIT 1;`,
            [cleanEmail]
          );
          if (adminRes.rows.length > 0) {
            user = adminRes.rows[0];
            isAdminAccount = true;
          }
        }

        if (!user) {
          res.statusCode = 401;
          res.end(JSON.stringify({ success: false, error: 'ไม่พบบัญชีผู้ใช้งานนี้ในระบบ' }));
          return;
        }

        if (user.isActive === false) {
          res.statusCode = 403;
          res.end(JSON.stringify({ success: false, error: 'บัญชีผู้ใช้งานนี้ถูกระงับการใช้งานชั่วคราว' }));
          return;
        }

        // Verify password using bcrypt
        let isMatch = false;
        try {
          if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$')) {
            isMatch = bcrypt.compareSync(password, user.password);
          } else {
            isMatch = user.password === password;
          }
        } catch (err) {
          isMatch = false;
        }

        if (!isMatch) {
          res.statusCode = 401;
          res.end(JSON.stringify({ success: false, error: 'รหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง' }));
          return;
        }

        // Fetch extra role details
        let pdInfo = null;
        let agentInfo = null;
        let storeInfo = null;

        if (user.role === 'pd' || role === 'pd') {
          const pdRes = await pool.query(`SELECT * FROM "ProvincialDirector" WHERE "userId" = $1 LIMIT 1;`, [user.id]);
          pdInfo = pdRes.rows[0] || null;
        }

        if (user.role === 'agent' || role === 'agent') {
          const agRes = await pool.query(`SELECT * FROM "Agent" WHERE "userId" = $1 LIMIT 1;`, [user.id]);
          agentInfo = agRes.rows[0] || null;
        }

        if (user.role === 'owner' || user.role === 'merchant' || role === 'merchant') {
          const stRes = await pool.query(`SELECT * FROM "Store" WHERE "userId" = $1 LIMIT 1;`, [user.id]);
          storeInfo = stRes.rows[0] || null;
        }

        if (isAdminAccount) {
          pool.query(`UPDATE "AdminAccount" SET "lastLoginAt" = NOW(), "updatedAt" = NOW() WHERE id = $1`, [user.id]).catch(() => {});
        }

        const token = crypto.randomBytes(32).toString('hex');

        res.statusCode = 200;
        res.end(
          JSON.stringify({
            success: true,
            token,
            user: {
              id: user.id,
              name: user.name,
              email: user.email,
              phone: user.phone,
              role: user.role,
              avatar: user.avatar,
              pd: pdInfo,
              agent: agentInfo,
              store: storeInfo,
            },
            message: 'เข้าสู่ระบบสำเร็จ',
          })
        );
        return;
      }

      // ── AUTH: 2. POST /api/db/auth/register-pd ─────────────────────
      if (url === '/api/db/auth/register-pd' && req.method === 'POST') {
        try {
          const body = await parseJsonBody(req);
          const { email, password, name, phone, code, displayName, investmentAmount, territoryId, kycData } = body;

          if (!email || !password || !name) {
            res.statusCode = 200;
            res.end(JSON.stringify({ success: false, error: 'กรุณากรอกข้อมูลที่จำเป็น (ชื่อ, อีเมล, รหัสผ่าน)' }));
            return;
          }

          const cleanEmail = String(email).trim().toLowerCase();
          const existing = await pool.query(`SELECT id FROM "User" WHERE LOWER(email) = $1 LIMIT 1;`, [cleanEmail]);
          if (existing.rows.length > 0) {
            res.statusCode = 200;
            res.end(JSON.stringify({ success: false, error: 'อีเมลนี้ถูกใช้งานแล้ว กรุณาเข้าสู่ระบบ หรือใช้อีเมลอื่น' }));
            return;
          }

          const userId = crypto.randomUUID();
          const pdId = crypto.randomUUID();
          const kycId = crypto.randomUUID();
          const hashedPassword = bcrypt.hashSync(password, 10);
          const pdCode = code || `PD-${Date.now().toString().slice(-4)}`;

          await pool.query(
            `INSERT INTO "User" (id, name, email, phone, password, role, "isActive", "createdAt", "updatedAt") 
             VALUES ($1, $2, $3, $4, $5, 'pd', true, NOW(), NOW());`,
            [userId, name, cleanEmail, phone || null, hashedPassword]
          );

          await pool.query(
            `INSERT INTO "ProvincialDirector" (id, "userId", code, "displayName", status, "investmentAmount", "territoryId", "startedAt", "createdAt", "updatedAt")
             VALUES ($1, $2, $3, $4, 'active', $5, $6, NOW(), NOW(), NOW());`,
            [pdId, userId, pdCode, displayName || name, Number(investmentAmount) || 25000, territoryId || null]
          );

          if (kycData) {
            await pool.query(
              `INSERT INTO "KycVerification" (id, "userId", "businessName", "firstName", "lastName", phone, "taxId", "bankName", "bankAccountNumber", "bankAccountName", "currentAddress", status, "currentStep", "applicantType", "approvalLevel", "kycSize", "agreementAccepted", "submittedAt", "createdAt", "updatedAt")
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending', 1, 'individual', 'pending', 'L', true, NOW(), NOW(), NOW());`,
              [
                kycId,
                userId,
                kycData.businessName || displayName || name,
                kycData.firstName || name.split(' ')[0],
                kycData.lastName || name.split(' ')[1] || '',
                phone || null,
                kycData.taxId || kycData.idCard || null,
                kycData.bankName || null,
                kycData.bankAccountNumber || null,
                kycData.bankAccountName || name,
                kycData.address || null,
              ]
            );
          }

          res.statusCode = 200;
          res.end(
            JSON.stringify({
              success: true,
              message: 'ลงทะเบียนสมัครเป็น Partner Director (PD) สำเร็จ!',
              userId,
              pdId,
              code: pdCode,
            })
          );
          return;
        } catch (err) {
          console.error('[Register PD Error]', err);
          res.statusCode = 200;
          res.end(JSON.stringify({ success: false, error: err.message || 'เกิดข้อผิดพลาดในการลงทะเบียน PD' }));
          return;
        }
      }

      // ── AUTH: 3. POST /api/db/auth/register-agent ──────────────────
      if (url === '/api/db/auth/register-agent' && req.method === 'POST') {
        try {
          const body = await parseJsonBody(req);
          const { email, password, name, phone, code, tier, currentPdId, kycData } = body;

          if (!email || !password || !name) {
            res.statusCode = 200;
            res.end(JSON.stringify({ success: false, error: 'กรุณากรอกข้อมูลที่จำเป็น (ชื่อ, อีเมล, รหัสผ่าน)' }));
            return;
          }

          const cleanEmail = String(email).trim().toLowerCase();
          const existing = await pool.query(`SELECT id FROM "User" WHERE LOWER(email) = $1 LIMIT 1;`, [cleanEmail]);
          if (existing.rows.length > 0) {
            res.statusCode = 200;
            res.end(JSON.stringify({ success: false, error: 'อีเมลนี้ถูกใช้งานแล้ว กรุณาเข้าสู่ระบบ หรือใช้อีเมลอื่น' }));
            return;
          }

          const userId = crypto.randomUUID();
          const agentId = crypto.randomUUID();
          const kycId = crypto.randomUUID();
          const hashedPassword = bcrypt.hashSync(password, 10);
          const agentCode = code || `AG-${Date.now().toString().slice(-4)}`;

          await pool.query(
            `INSERT INTO "User" (id, name, email, phone, password, role, "isActive", "createdAt", "updatedAt") 
             VALUES ($1, $2, $3, $4, $5, 'agent', true, NOW(), NOW());`,
            [userId, name, cleanEmail, phone || null, hashedPassword]
          );

          await pool.query(
            `INSERT INTO "Agent" (id, "userId", code, tier, status, "adBudget", "baseAllowance", "walletBalance", "currentPdId", "createdAt", "updatedAt")
             VALUES ($1, $2, $3, $4, 'active', 100000.00, 4000.00, 0.00, $5, NOW(), NOW());`,
            [agentId, userId, agentCode, tier || 'STANDARD', currentPdId || null]
          );

          if (kycData) {
            await pool.query(
              `INSERT INTO "KycVerification" (id, "userId", "businessName", "firstName", "lastName", phone, "taxId", "bankName", "bankAccountNumber", "bankAccountName", "currentAddress", status, "currentStep", "applicantType", "approvalLevel", "kycSize", "agreementAccepted", "submittedAt", "createdAt", "updatedAt")
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending', 1, 'individual', 'pending', 'M', true, NOW(), NOW(), NOW());`,
              [
                kycId,
                userId,
                kycData.businessName || name,
                kycData.firstName || name.split(' ')[0],
                kycData.lastName || name.split(' ')[1] || '',
                phone || null,
                kycData.taxId || kycData.idCard || null,
                kycData.bankName || null,
                kycData.bankAccountNumber || null,
                kycData.bankAccountName || name,
                kycData.address || null,
              ]
            );
          }

          res.statusCode = 200;
          res.end(
            JSON.stringify({
              success: true,
              message: 'ลงทะเบียนสมัครเป็นตัวแทน (Agent) สำเร็จ!',
              userId,
              agentId,
              code: agentCode,
            })
          );
          return;
        } catch (err) {
          console.error('[Register Agent Error]', err);
          res.statusCode = 200;
          res.end(JSON.stringify({ success: false, error: err.message || 'เกิดข้อผิดพลาดในการลงทะเบียน Agent' }));
          return;
        }
      }

      // ── AUTH: 4. POST /api/db/auth/register-merchant ───────────────
      if (url === '/api/db/auth/register-merchant' && req.method === 'POST') {
        try {
          const body = await parseJsonBody(req);
          const { email, password, name, phone, storeName, storeType, address, payoutBank, payoutAccountNo, payoutAccountName, kycData, referralCode } = body;

          if (!email || !password || !name || !storeName) {
            res.statusCode = 200;
            res.end(JSON.stringify({ success: false, error: 'กรุณากรอกข้อมูลที่จำเป็น (ชื่อ, อีเมล, รหัสผ่าน, ชื่อร้านค้า)' }));
            return;
          }

          const cleanEmail = String(email).trim().toLowerCase();
          const existing = await pool.query(`SELECT id FROM "User" WHERE LOWER(email) = $1 LIMIT 1;`, [cleanEmail]);
          if (existing.rows.length > 0) {
            res.statusCode = 200;
            res.end(JSON.stringify({ success: false, error: 'อีเมลนี้ถูกใช้งานแล้ว กรุณาเข้าสู่ระบบ หรือใช้อีเมลอื่น' }));
            return;
          }

          const userId = crypto.randomUUID();
          const storeId = crypto.randomUUID();
          const kycId = crypto.randomUUID();
          const merchantIdentityId = crypto.randomUUID();
          const hashedPassword = bcrypt.hashSync(password, 10);
          const merchantId = `S${Date.now().toString().slice(-9)}`;

          await pool.query(
            `INSERT INTO "User" (id, name, email, phone, password, role, "isActive", "createdAt", "updatedAt") 
             VALUES ($1, $2, $3, $4, $5, 'owner', true, NOW(), NOW());`,
            [userId, name, cleanEmail, phone || null, hashedPassword]
          );

          await pool.query(
            `INSERT INTO "Store" (id, name, description, address, phone, "userId", "isActive", currency, language, "isOnboarded", tier, "subscriptionStatus", "monthlyGmvUsed", "monthlyTxnCount", "storeType", "memberStatus", "payoutBankName", "payoutAccountNumber", "payoutAccountName", "referralCodeUsed", "createdAt", "updatedAt")
             VALUES ($1, $2, $3, $4, $5, $6, true, 'THB', 'th', false, 'FREE', 'active', 0.00, 0, $7, 'non_member', $8, $9, $10, $11, NOW(), NOW());`,
            [
              storeId,
              storeName,
              `${storeName} (ร้านค้า ChatPOS)`,
              address || null,
              phone || null,
              userId,
              storeType || 'MAIN',
              payoutBank || null,
              payoutAccountNo || null,
              payoutAccountName || name,
              referralCode || null,
            ]
          );

          await pool.query(
            `INSERT INTO "MerchantIdentity" (id, "merchantId", "clientId", "issuedType", "registeredAt", source, "issuedAt", "lockedAt", "createdAt", "updatedAt")
             VALUES ($1, $2, $3, 'S', NOW(), 'chatpos', NOW(), NOW(), NOW(), NOW());`,
            [merchantIdentityId, merchantId, storeId]
          );

          if (kycData) {
            await pool.query(
              `INSERT INTO "KycVerification" (id, "userId", "businessName", "firstName", "lastName", phone, "taxId", "bankName", "bankAccountNumber", "bankAccountName", "businessAddress", status, "currentStep", "applicantType", "approvalLevel", "kycSize", "agreementAccepted", "submittedAt", "createdAt", "updatedAt")
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending', 1, 'physical_store', 'pending', 'S', true, NOW(), NOW(), NOW());`,
              [
                kycId,
                userId,
                storeName,
                kycData.firstName || name.split(' ')[0],
                kycData.lastName || name.split(' ')[1] || '',
                phone || null,
                kycData.taxId || null,
                payoutBank || null,
                payoutAccountNo || null,
                payoutAccountName || name,
                address || null,
              ]
            );
          }

          res.statusCode = 200;
          res.end(
            JSON.stringify({
              success: true,
              message: 'ลงทะเบียนเปิดร้านค้าใหม่ (Merchant) สำเร็จ!',
              userId,
              storeId,
              merchantId,
            })
          );
          return;
        } catch (err) {
          console.error('[Register Merchant Error]', err);
          res.statusCode = 200;
          res.end(JSON.stringify({ success: false, error: err.message || 'เกิดข้อผิดพลาดในการลงทะเบียนร้านค้า' }));
          return;
        }
      }

      // ── 5. GET /api/db/health ──────────────────────────────────────
      if (url === '/api/db/health' || url.startsWith('/api/db/health?')) {
        const healthRes = await pool.query(`
          SELECT 
            current_database() as database, 
            current_user as user,
            version() as version,
            (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public') as total_tables;
        `);
        res.statusCode = 200;
        res.end(
          JSON.stringify({
            success: true,
            status: 'connected',
            host: process.env.PGHOST,
            port: process.env.PGPORT,
            ...healthRes.rows[0],
          })
        );
        return;
      }

      // ── 6. GET /api/db/stats ────────────────────────────────────────
      if (url === '/api/db/stats' || url.startsWith('/api/db/stats?')) {
        const stats = await pool.query(`
          SELECT 
            (SELECT count(*) FROM "Store") as total_stores,
            (SELECT count(*) FROM "Store" WHERE "isActive" = true) as active_stores,
            (SELECT count(*) FROM "Agent") as total_agents,
            (SELECT count(*) FROM "ProvincialDirector") as total_pds,
            (SELECT count(*) FROM "Transaction") as total_transactions,
            (SELECT coalesce(sum(CAST("amount" as numeric)), 0) FROM "Transaction") as total_volume,
            (SELECT coalesce(sum(CAST("amount" as numeric)), 0) FROM "Transaction" WHERE "createdAt" >= CURRENT_DATE) as today_volume,
            (SELECT count(*) FROM "KycVerification" WHERE "status" = 'pending') as pending_kyc,
            (SELECT count(*) FROM "KycVerification" WHERE "status" = 'approved') as approved_kyc,
            (SELECT count(*) FROM "Product") as total_products,
            (SELECT coalesce(sum(CAST("amount" as numeric)), 0) FROM "CommissionLedger") as total_commission;
        `);
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, stats: stats.rows[0] }));
        return;
      }

      // ── 7. GET /api/db/kyc ──────────────────────────────────────────
      if (url === '/api/db/kyc' || url.startsWith('/api/db/kyc?')) {
        const result = await pool.query(`
          SELECT 
            k.id,
            k."businessName",
            k."firstName",
            k."lastName",
            k."phone",
            k."status",
            k."businessType",
            k."approvalLevel",
            k."kycSize",
            k."taxId",
            k."bankName",
            k."bankAccountNumber",
            k."bankAccountName",
            k."currentAddress",
            k."reviewNotes",
            k."submittedAt",
            k."reviewedAt",
            k."createdAt",
            k."updatedAt",
            u.email as user_email,
            u.name as user_name
          FROM "KycVerification" k
          LEFT JOIN "User" u ON k."userId" = u.id
          ORDER BY k."createdAt" DESC
          LIMIT 100;
        `);
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, count: result.rows.length, data: result.rows }));
        return;
      }

      // ── 8. GET /api/db/stores ──────────────────────────────────────
      if (url === '/api/db/stores' || url.startsWith('/api/db/stores?')) {
        const result = await pool.query(`
          SELECT 
            s.id,
            s.name,
            s.description,
            s.phone,
            s.address,
            s."storeType",
            s.tier,
            s."isActive",
            s."monthlyGmvUsed",
            s."monthlyTxnCount",
            s."accountNumber",
            s."payoutBankName",
            s."payoutAccountNumber",
            s."payoutAccountName",
            s."createdAt",
            s."updatedAt",
            mi."merchantId",
            u.name as owner_name,
            u.email as owner_email,
            a.code as agent_code,
            pd.code as pd_code,
            pd."displayName" as pd_name
          FROM "Store" s
          LEFT JOIN "MerchantIdentity" mi ON s.id = mi."clientId"
          LEFT JOIN "User" u ON s."userId" = u.id
          LEFT JOIN "Agent" a ON s."currentAgentId" = a.id
          LEFT JOIN "ProvincialDirector" pd ON s."currentPdId" = pd.id
          ORDER BY s."createdAt" DESC
          LIMIT 100;
        `);
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, count: result.rows.length, data: result.rows }));
        return;
      }

      // ── 9. GET /api/db/agents ──────────────────────────────────────
      if (url === '/api/db/agents' || url.startsWith('/api/db/agents?')) {
        const result = await pool.query(`
          SELECT 
            a.id,
            a.code,
            a.tier,
            a.status,
            a."walletBalance",
            a."adBudget",
            a."baseAllowance",
            a."createdAt",
            u.name as agent_name,
            u.email as agent_email,
            u.phone as agent_phone,
            pd.code as pd_code,
            pd."displayName" as pd_name,
            (SELECT count(*) FROM "Store" WHERE "currentAgentId" = a.id) as stores_count,
            (SELECT coalesce(sum(CAST("amount" as numeric)), 0) FROM "CommissionLedger" WHERE "agentId" = a.id) as earned_commission
          FROM "Agent" a
          LEFT JOIN "User" u ON a."userId" = u.id
          LEFT JOIN "ProvincialDirector" pd ON a."currentPdId" = pd.id
          ORDER BY a."createdAt" DESC;
        `);
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, count: result.rows.length, data: result.rows }));
        return;
      }

      // ── 10. GET /api/db/pds ────────────────────────────────────────
      if (url === '/api/db/pds' || url.startsWith('/api/db/pds?')) {
        const result = await pool.query(`
          SELECT 
            pd.id,
            pd.code,
            pd."displayName",
            pd.status,
            pd."investmentAmount",
            pd."startedAt",
            pd."createdAt",
            u.name as pd_owner_name,
            u.email as pd_email,
            u.phone as pd_phone,
            (SELECT count(*) FROM "Agent" WHERE "currentPdId" = pd.id) as agent_count,
            (SELECT count(*) FROM "Store" WHERE "currentPdId" = pd.id) as store_count,
            (SELECT coalesce(sum(CAST("amount" as numeric)), 0) FROM "CommissionLedger" WHERE "pdId" = pd.id) as total_pd_commission
          FROM "ProvincialDirector" pd
          LEFT JOIN "User" u ON pd."userId" = u.id
          ORDER BY pd."createdAt" DESC;
        `);
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, count: result.rows.length, data: result.rows }));
        return;
      }

      // ── 11. GET /api/db/transactions ───────────────────────────────
      if (url === '/api/db/transactions' || url.startsWith('/api/db/transactions?')) {
        const result = await pool.query(`
          SELECT 
            t.id,
            t.reference,
            t.amount,
            t.fee,
            t."netAmount",
            t.channel,
            t.status,
            t."customerName",
            t."customerPhone",
            t.note,
            t."paymentMethod",
            t."isSettled",
            t."createdAt",
            s.name as store_name
          FROM "Transaction" t
          LEFT JOIN "Store" s ON t."storeId" = s.id
          ORDER BY t."createdAt" DESC
          LIMIT 100;
        `);
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, count: result.rows.length, data: result.rows }));
        return;
      }

      // ── 11.1 POST /api/db/transactions/create ───────────────────────
      if (req.method === 'POST' && url === '/api/db/transactions/create') {
        try {
          const body = await parseJsonBody(req);
          const {
            amount,
            storeId,
            userId,
            channel = 'promptpay',
            paymentMethod = 'PromptPay พร้อมเพย์ QR',
            customerName = 'ลูกค้าหน้าร้าน',
            customerPhone = null,
            tableName = 'คิดเงินหน้าร้าน',
            note = 'ชำระเงินผ่านระบบ PromptPay QR',
            origin = 'POS',
          } = body;

          const id = crypto.randomUUID();
          const reference = `TXN-${Date.now().toString().slice(-8)}`;
          const parsedAmount = parseFloat(amount) || 0;
          const fee = 0;
          const netAmount = parsedAmount;

          // Find a target storeId if not provided
          let targetStoreId = storeId;
          if (!targetStoreId) {
            const storeRes = await pool.query('SELECT id FROM "Store" ORDER BY "createdAt" DESC LIMIT 1;');
            targetStoreId = storeRes.rows[0]?.id;
          }

          const insertRes = await pool.query(
            `
            INSERT INTO "Transaction" (
              id, reference, amount, fee, "netAmount", channel, status,
              "storeId", "userId", currency, "kitchenStatus", origin,
              "paymentMethod", "paymentMethodLabel", "customerName", "customerPhone",
              "tableName", note, "createdAt", "updatedAt", "paidAt"
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7,
              $8, $9, $10, $11, $12,
              $13, $14, $15, $16,
              $17, $18, NOW(), NOW(), NOW()
            )
            RETURNING *;
            `,
            [
              id,
              reference,
              parsedAmount,
              fee,
              netAmount,
              channel,
              'completed',
              targetStoreId,
              userId || null,
              'THB',
              'SERVED',
              origin,
              paymentMethod,
              paymentMethod,
              customerName,
              customerPhone,
              tableName,
              note,
            ]
          );

          res.statusCode = 200;
          res.end(JSON.stringify({ success: true, transaction: insertRes.rows[0] }));
          return;
        } catch (err) {
          console.error('Error creating real transaction:', err);
          res.statusCode = 500;
          res.end(JSON.stringify({ success: false, error: err.message || 'Failed to create transaction' }));
          return;
        }
      }

      // ── 12. GET /api/db/products ───────────────────────────────────
      if (url === '/api/db/products' || url.startsWith('/api/db/products?')) {
        const result = await pool.query(`
          SELECT 
            p.id,
            p.name,
            p.description,
            p.price,
            p.cost,
            p.stock,
            p.category,
            p.image,
            p.sku,
            p."isActive",
            p."trackStock",
            p."createdAt",
            s.name as store_name
          FROM "Product" p
          LEFT JOIN "Store" s ON p."storeId" = s.id
          ORDER BY p."createdAt" DESC
          LIMIT 100;
        `);
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, count: result.rows.length, data: result.rows }));
        return;
      }

      // ── 13. GET /api/db/commissions ────────────────────────────────
      if (url === '/api/db/commissions' || url.startsWith('/api/db/commissions?')) {
        const result = await pool.query(`
          SELECT 
            c.id,
            c."sourceType",
            c."sourceRef",
            c."beneficiaryType",
            c.amount,
            c."grossAmount",
            c."ratePercent",
            c.status,
            c."ruleCode",
            c."earnedAt",
            c."createdAt",
            a.code as agent_code,
            pd.code as pd_code,
            s.name as store_name
          FROM "CommissionLedger" c
          LEFT JOIN "Agent" a ON c."agentId" = a.id
          LEFT JOIN "ProvincialDirector" pd ON c."pdId" = pd.id
          LEFT JOIN "Store" s ON c."storeId" = s.id
          ORDER BY c."createdAt" DESC
          LIMIT 100;
        `);
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, count: result.rows.length, data: result.rows }));
        return;
      }

      // ── 14. POST /api/db/kyc/update-status ─────────────────────────
      if (url === '/api/db/kyc/update-status' && req.method === 'POST') {
        const body = await parseJsonBody(req);
        const { id, status, reviewNotes } = body;
        if (!id || !status) {
          res.statusCode = 400;
          res.end(JSON.stringify({ success: false, error: 'id and status required' }));
          return;
        }

        await pool.query(
          `UPDATE "KycVerification" 
           SET "status" = $1, "reviewNotes" = $2, "reviewedAt" = NOW(), "updatedAt" = NOW() 
           WHERE id = $3;`,
          [status, reviewNotes || null, id]
        );

        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, message: 'KYC status updated successfully' }));
        return;
      }

      // ── DEVELOPER API: 15. POST /api/v1/payments/qr ──────────────────
      if (req.method === 'POST' && (url === '/api/v1/payments/qr' || url.startsWith('/api/v1/payments/qr?'))) {
        const body = await parseJsonBody(req);
        const {
          amount,
          channel = 'promptpay',
          orderId,
          customerName = 'ลูกค้าหน้าร้าน',
          customerPhone = null,
          note = 'สร้าง QR ชำระเงินผ่าน Developer API',
          promptPayId: customPromptPay,
          tableName = 'คิดเงินหน้าร้าน'
        } = body;

        const parsedAmount = parseFloat(amount) || 0;
        const id = crypto.randomUUID();
        const reference = orderId || `TXN-${Date.now().toString().slice(-8)}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

        // 1. Resolve store & PromptPay recipient
        const storeRes = await pool.query('SELECT id, name, phone, "qrSettings", "webhookUrl", "webhookSecret" FROM "Store" ORDER BY "createdAt" DESC LIMIT 1;');
        const store = storeRes.rows[0];
        const targetPromptPay = customPromptPay || store?.phone || (store?.qrSettings && store.qrSettings.promptPayId) || '0823456789';

        // 2. Generate standard EMVCo PromptPay QR string & base64 image
        const emvcoPayload = generatePromptPayPayload(targetPromptPay, parsedAmount);
        const qrDataUrl = await QRCode.toDataURL(emvcoPayload, {
          errorCorrectionLevel: 'M',
          margin: 1,
          width: 320,
          color: { dark: '#0f172a', light: '#ffffff' }
        });

        // 3. Insert real pending Transaction in PostgreSQL
        await pool.query(
          `INSERT INTO "Transaction" (
            id, reference, amount, fee, "netAmount", channel, status,
            "storeId", currency, "kitchenStatus", origin,
            "paymentMethod", "paymentMethodLabel", "customerName", "customerPhone",
            "tableName", note, "createdAt", "updatedAt"
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7,
            $8, $9, $10, $11,
            $12, $13, $14, $15,
            $16, $17, NOW(), NOW()
          );`,
          [
            id,
            reference,
            parsedAmount,
            0,
            parsedAmount,
            channel,
            'pending',
            store?.id || null,
            'THB',
            'NONE',
            'API_DEVELOPER',
            'PromptPay พร้อมเพย์ QR',
            'PromptPay พร้อมเพย์ QR',
            customerName,
            customerPhone,
            tableName,
            note
          ]
        );

        // 4. Log in WebhookEventLog for Developer Console Live Stream
        await pool.query(
          `INSERT INTO "WebhookEventLog" (
            id, "storeId", "eventType", status, "payloadJson", "createdAt", "updatedAt"
          ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
          ON CONFLICT DO NOTHING;`,
          [
            crypto.randomUUID(),
            store?.id || null,
            'payment.created',
            'DELIVERED',
            JSON.stringify({
              event: 'payment.created',
              reference,
              amount: parsedAmount,
              channel,
              createdAt: new Date().toISOString()
            })
          ]
        ).catch(() => {});

        res.statusCode = 200;
        res.end(JSON.stringify({
          success: true,
          reference,
          amount: parsedAmount,
          currency: 'THB',
          channel,
          qrCodeUrl: qrDataUrl,
          qrRawText: emvcoPayload,
          status: 'pending',
          expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          merchantPromptPayId: targetPromptPay
        }));
        return;
      }

      // ── DEVELOPER API: 16. GET /api/v1/payments/:reference ────────────
      if (req.method === 'GET' && url.startsWith('/api/v1/payments/')) {
        const ref = decodeURIComponent(url.replace('/api/v1/payments/', '').split('?')[0]);
        const txnRes = await pool.query(
          `SELECT t.*, s.name as store_name FROM "Transaction" t LEFT JOIN "Store" s ON t."storeId" = s.id WHERE t.reference = $1 OR t.id = $1 LIMIT 1;`,
          [ref]
        );
        if (txnRes.rows.length === 0) {
          res.statusCode = 404;
          res.end(JSON.stringify({ success: false, error: 'Transaction reference not found' }));
          return;
        }
        const txn = txnRes.rows[0];
        res.statusCode = 200;
        res.end(JSON.stringify({
          success: true,
          reference: txn.reference,
          status: txn.status,
          amount: parseFloat(txn.amount),
          currency: txn.currency || 'THB',
          channel: txn.channel,
          customerName: txn.customerName,
          paidAt: txn.paidAt,
          createdAt: txn.createdAt,
          storeName: txn.store_name
        }));
        return;
      }

      // ── DEVELOPER API: 17. POST /api/v1/payments/confirm ──────────────
      if (req.method === 'POST' && (url === '/api/v1/payments/confirm' || url.startsWith('/api/v1/payments/confirm?') || url.includes('/confirm'))) {
        const body = await parseJsonBody(req);
        const ref = body.reference || decodeURIComponent(url.replace('/api/v1/payments/', '').replace('/confirm', '').split('?')[0]);

        const updateRes = await pool.query(
          `UPDATE "Transaction" 
           SET status = 'completed', "paidAt" = NOW(), "updatedAt" = NOW() 
           WHERE reference = $1 OR id = $1
           RETURNING *;`,
          [ref]
        );

        if (updateRes.rows.length === 0) {
          res.statusCode = 404;
          res.end(JSON.stringify({ success: false, error: 'Transaction not found to confirm' }));
          return;
        }

        const txn = updateRes.rows[0];

        // Log event in WebhookEventLog
        await pool.query(
          `INSERT INTO "WebhookEventLog" (
            id, "storeId", "eventType", status, "payloadJson", "createdAt", "updatedAt"
          ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
          ON CONFLICT DO NOTHING;`,
          [
            crypto.randomUUID(),
            txn.storeId,
            'payment.success',
            'DELIVERED',
            JSON.stringify({
              event: 'payment.success',
              reference: txn.reference,
              amount: parseFloat(txn.amount),
              channel: txn.channel,
              paidAt: txn.paidAt
            })
          ]
        ).catch(() => {});

        res.statusCode = 200;
        res.end(JSON.stringify({
          success: true,
          reference: txn.reference,
          status: 'completed',
          amount: parseFloat(txn.amount),
          paidAt: txn.paidAt
        }));
        return;
      }

      // ── DEVELOPER API: 18. GET /api/v1/balance ─────────────────────────
      if (req.method === 'GET' && (url === '/api/v1/balance' || url.startsWith('/api/v1/balance?'))) {
        const statsRes = await pool.query(
          `SELECT COALESCE(SUM(amount), 0) as total_balance, COUNT(id) as txns_count FROM "Transaction" WHERE status = 'completed';`
        );
        const stat = statsRes.rows[0];
        res.statusCode = 200;
        res.end(JSON.stringify({
          success: true,
          balance: parseFloat(stat.total_balance) || 0,
          currency: 'THB',
          txnCount: parseInt(stat.txns_count, 10) || 0,
          monthlyGmv: parseFloat(stat.total_balance) || 0
        }));
        return;
      }

      // ── DEVELOPER API: 19. POST /api/v1/auth ───────────────────────────
      if (req.method === 'POST' && (url === '/api/v1/auth' || url.startsWith('/api/v1/auth?'))) {
        const token = 'cpos_jwt_' + crypto.randomBytes(16).toString('hex');
        res.statusCode = 200;
        res.end(JSON.stringify({
          success: true,
          token,
          accessToken: token,
          expiresIn: 86400,
          tokenType: 'Bearer'
        }));
        return;
      }

      // ── DEVELOPER API: 20. POST /api/v1/payouts ────────────────────────
      if (req.method === 'POST' && (url === '/api/v1/payouts' || url.startsWith('/api/v1/payouts?'))) {
        const body = await parseJsonBody(req);
        const payoutId = `PO-${Date.now().toString().slice(-8)}`;
        res.statusCode = 200;
        res.end(JSON.stringify({
          success: true,
          payoutId,
          reference: `REF-${payoutId}`,
          amount: body.amount || 0,
          status: 'processing',
          createdAt: new Date().toISOString()
        }));
        return;
      }

      // ── DEVELOPER API: 21. GET /api/v1/developer/logs ──────────────────
      if (req.method === 'GET' && (url === '/api/v1/developer/logs' || url.startsWith('/api/v1/developer/logs?'))) {
        const logsRes = await pool.query(
          `SELECT 
            id, 
            "eventType" as event, 
            status, 
            "payloadJson" as payload, 
            "createdAt" as timestamp 
           FROM "WebhookEventLog" 
           ORDER BY "createdAt" DESC 
           LIMIT 25;`
        ).catch(() => ({ rows: [] }));

        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, logs: logsRes.rows }));
        return;
      }

      // 404 for unknown endpoint
      res.statusCode = 404;
      res.end(JSON.stringify({ success: false, error: `Endpoint ${url} not found` }));
      return;
    } catch (err) {
      console.error('[Server DB API Error]:', err.message);
      res.statusCode = 500;
      res.end(JSON.stringify({ success: false, error: err.message }));
      return;
    }
  }

  // Serve static dist files
  let safePath = path.normalize(url.split('?')[0]);
  if (safePath === '/' || safePath === '') {
    safePath = '/index.html';
  }

  let filePath = path.join(__dirname, 'dist', safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      filePath = path.join(__dirname, 'dist', 'index.html');
    }

    const ext = path.extname(filePath);
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Error loading ' + safePath);
        return;
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    });
  });
});

server.listen(port, () => {
  console.log(`🚀 ChatPOS Production Server running at http://localhost:${port}`);
  console.log(`📍 Database configured: ${configuredDatabaseName}`);
});
