'use strict';

const DEFAULT_BASE_URL = 'https://pub.smsup-plus.com';
const DEFAULT_TIMEOUT_MS = 10000;

class SmsupError extends Error {
  constructor(message, code, statusCode = 502, details = {}) {
    super(message);
    this.name = 'SmsupError';
    this.code = code;
    this.statusCode = statusCode;
    Object.assign(this, details);
  }
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function loadSmsupConfig(env = process.env) {
  return {
    baseUrl: String(env.SMSUP_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, ''),
    otpConfigId: String(env.SMSUP_OTP_CONFIG_ID || '').trim(),
    token: String(env.SMSUP_TOKEN || '').trim(),
    username: String(env.SMSUP_USERNAME || '').trim(),
    password: String(env.SMSUP_PASSWORD || ''),
    timeoutMs: parsePositiveInteger(env.SMSUP_OTP_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
  };
}

function toInternationalPhone(phone) {
  const digits = String(phone || '').replace(/[^0-9]/g, '');
  if (/^0[0-9]{9}$/.test(digits)) return `66${digits.slice(1)}`;
  if (/^66[0-9]{9}$/.test(digits)) return digits;
  throw new SmsupError('A valid Thai mobile phone is required', 'SMSUP_PHONE_INVALID', 422);
}

function createAuthorizationHeader(config) {
  if (config.token) return `Bearer ${config.token}`;
  if (config.username && config.password) {
    const encoded = Buffer.from(`${config.username}:${config.password}`, 'utf8').toString('base64');
    return `Basic ${encoded}`;
  }
  throw new SmsupError('SMSUP credentials are not configured', 'SMSUP_CREDENTIALS_MISSING', 503);
}

async function readResponseBody(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function apiErrorDetails(data) {
  const error = data?.error;
  return {
    providerCode: data?.code || data?.status || error?.code || null,
    providerMessage: data?.description || data?.message || error?.description || error?.message || null,
  };
}

function createSmsupProvider(options = {}) {
  const config = options.config || loadSmsupConfig(options.env || process.env);
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const now = options.now || (() => Date.now());

  async function call(path, body) {
    if (typeof fetchImpl !== 'function') {
      throw new SmsupError('Fetch is not available', 'SMSUP_FETCH_UNAVAILABLE', 503);
    }
    if (!config.baseUrl) throw new SmsupError('SMSUP base URL is not configured', 'SMSUP_BASE_URL_MISSING', 503);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
    try {
      const response = await fetchImpl(`${config.baseUrl}${path}`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: createAuthorizationHeader(config),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const data = await readResponseBody(response);
      if (!response.ok) {
        throw new SmsupError('SMSUP rejected the request', 'SMSUP_REQUEST_FAILED', 502, apiErrorDetails(data));
      }
      if (data?.error || (data?.status && String(data.status) !== '200' && data?.status !== 200 && !data?.otpId && data?.result !== true)) {
        throw new SmsupError('SMSUP returned an error', 'SMSUP_API_ERROR', 502, apiErrorDetails(data));
      }
      return data;
    } catch (error) {
      if (error instanceof SmsupError) throw error;
      if (error?.name === 'AbortError') {
        throw new SmsupError('SMSUP request timed out', 'SMSUP_TIMEOUT', 504, { timeoutMs: config.timeoutMs });
      }
      throw new SmsupError('SMSUP request failed', 'SMSUP_NETWORK_ERROR', 502, { cause: error?.code || error?.name || 'unknown' });
    } finally {
      clearTimeout(timeout);
    }
  }

  async function request({ phone }) {
    if (!config.otpConfigId) throw new SmsupError('SMSUP OTP config ID is not configured', 'SMSUP_OTP_CONFIG_ID_MISSING', 503);
    const data = await call('/otp/requestOTP', {
      otcId: config.otpConfigId,
      mobile: toInternationalPhone(phone),
    });
    if (!data?.otpId) {
      throw new SmsupError('SMSUP did not return an OTP ID', 'SMSUP_RESPONSE_INVALID', 502, apiErrorDetails(data));
    }
    return {
      providerOtpId: String(data.otpId),
      referenceCode: data.referenceCode ? String(data.referenceCode) : null,
    };
  }

  async function verify({ providerOtpId, otp }) {
    if (!providerOtpId) throw new SmsupError('SMSUP OTP ID is missing', 'SMSUP_OTP_ID_MISSING', 422);
    const data = await call('/otp/verifyOTP', {
      otpId: String(providerOtpId),
      otpCode: String(otp || '').trim(),
    });
    return { verified: data?.result === true || String(data?.result).toLowerCase() === 'true' };
  }

  async function checkBalance() {
    const startedAt = now();
    const data = await call('/account/balance', {});
    return { data, durationMs: Math.max(0, now() - startedAt) };
  }

  return { request, verify, checkBalance };
}

module.exports = {
  SmsupError,
  createSmsupProvider,
  loadSmsupConfig,
  toInternationalPhone,
};
