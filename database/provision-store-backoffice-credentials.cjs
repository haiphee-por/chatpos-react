const path = require('path');
const dotenv = require('dotenv');
const { Client } = require('pg');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const missing = [];
const required = (name) => {
  const value = String(process.env[name] || '').trim();
  if (!value) missing.push(name);
  return value;
};

const storeId = required('BACKOFFICE_MAPPING_STORE_ID');
const environment = String(process.env.BACKOFFICE_MAPPING_ENVIRONMENT || process.env.AGENT_PD_CREDENTIAL_ENVIRONMENT || 'production').trim();
const baseUrl = required('BACKOFFICE_MAPPING_BASE_URL');
const backofficeStoreId = String(process.env.BACKOFFICE_MAPPING_BACKOFFICE_STORE_ID || '').trim() || null;
const keyId = required('BACKOFFICE_MAPPING_KEY_ID');
const bearerSecretRef = String(process.env.BACKOFFICE_MAPPING_BEARER_SECRET_REF || 'env:CHATPOS_BACKOFFICE_BEARER_SECRET').trim();
const signingSecretRef = String(process.env.BACKOFFICE_MAPPING_SIGNING_SECRET_REF || 'env:CHATPOS_BACKOFFICE_SIGNING_SECRET').trim();
const callbackSecretRef = String(process.env.BACKOFFICE_MAPPING_CALLBACK_SECRET_REF || 'db:encrypted').trim();

if (missing.length > 0) {
  throw new Error(`Missing required mapping configuration: ${missing.join(', ')}`);
}

if (!/^https:\/\/[^/]+(?:\/[^/]*)?$/.test(baseUrl)) {
  throw new Error('BACKOFFICE_MAPPING_BASE_URL must be an HTTPS URL without credentials');
}
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(storeId)) {
  throw new Error('BACKOFFICE_MAPPING_STORE_ID must be a valid UUID');
}
for (const [name, value] of Object.entries({ bearerSecretRef, signingSecretRef })) {
  if (!value.startsWith('env:') && !value.startsWith('file:')) {
    throw new Error(`${name} must use an env: or file: secret-manager reference`);
  }
}
if (!callbackSecretRef.startsWith('env:') && !callbackSecretRef.startsWith('file:') && callbackSecretRef !== 'db:encrypted') {
  throw new Error('callbackSecretRef must use env:, file:, or db:encrypted');
}

const client = new Client({
  connectionString: process.env.DATABASE_URL || undefined,
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT) || 5432,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  connectionTimeoutMillis: 5000,
});

async function provision() {
  await client.connect();
  try {
    const result = await client.query(
      `INSERT INTO backoffice_store_credentials
        ("storeId", environment, "backofficeBaseUrl", "backofficeStoreId", "keyId",
         "bearerSecretRef", "signingSecretRef", "callbackSecretRef", status, "validFrom", "expiresAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ACTIVE', NOW(), NULL)
       ON CONFLICT ("storeId", environment) DO UPDATE SET
         "backofficeBaseUrl" = EXCLUDED."backofficeBaseUrl",
         "backofficeStoreId" = COALESCE(EXCLUDED."backofficeStoreId", backoffice_store_credentials."backofficeStoreId"),
         "keyId" = EXCLUDED."keyId",
         "bearerSecretRef" = EXCLUDED."bearerSecretRef",
         "signingSecretRef" = EXCLUDED."signingSecretRef",
         "callbackSecretRef" = EXCLUDED."callbackSecretRef",
         status = 'ACTIVE',
         "validFrom" = COALESCE(backoffice_store_credentials."validFrom", NOW()),
         "expiresAt" = NULL,
         "updatedAt" = NOW()
       RETURNING "storeId", environment, "backofficeBaseUrl", "backofficeStoreId", "keyId", status, "validFrom", "expiresAt"`,
      [storeId, environment, baseUrl.replace(/\/$/, ''), backofficeStoreId, keyId, bearerSecretRef, signingSecretRef, callbackSecretRef]
    );
    console.log(JSON.stringify(result.rows[0], null, 2));
  } finally {
    await client.end();
  }
}

provision().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});