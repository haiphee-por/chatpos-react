'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  SmsupError,
  createSmsupProvider,
  loadSmsupConfig,
  toInternationalPhone,
} = require('./smsupClient.cjs');

function response(status, data) {
  const text = JSON.stringify(data);
  return {
    status,
    ok: status >= 200 && status < 300,
    text: async () => text,
  };
}

test('loads SMSUP config and converts Thai mobile numbers to international format', () => {
  const config = loadSmsupConfig({
    SMSUP_BASE_URL: 'https://smsup.test/',
    SMSUP_OTP_CONFIG_ID: 'otc-1',
    SMSUP_USERNAME: 'user',
    SMSUP_PASSWORD: 'pass',
    SMSUP_OTP_TIMEOUT_MS: '1200',
  });

  assert.deepEqual(config, {
    baseUrl: 'https://smsup.test',
    otpConfigId: 'otc-1',
    token: '',
    username: 'user',
    password: 'pass',
    timeoutMs: 1200,
  });
  assert.equal(toInternationalPhone('081-234-5678'), '66812345678');
  assert.equal(toInternationalPhone('+66812345678'), '66812345678');
});

test('requests an SMSUP OTP with Basic Auth and maps otpId', async () => {
  const calls = [];
  const provider = createSmsupProvider({
    config: {
      baseUrl: 'https://smsup.test',
      otpConfigId: 'otc-1',
      token: '',
      username: 'user',
      password: 'pass',
      timeoutMs: 1000,
    },
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return response(200, { otcId: 'otc-1', otpId: 'otp-1', referenceCode: 'AB123', success: { message: 'success' } });
    },
  });

  const result = await provider.request({ phone: '0812345678' });
  assert.deepEqual(result, { providerOtpId: 'otp-1', referenceCode: 'AB123' });
  assert.equal(calls[0].url, 'https://smsup.test/otp/requestOTP');
  assert.equal(calls[0].options.headers.Authorization, `Basic ${Buffer.from('user:pass').toString('base64')}`);
  assert.deepEqual(JSON.parse(calls[0].options.body), { otcId: 'otc-1', mobile: '66812345678' });
});

test('verifies an SMSUP OTP and maps the result', async () => {
  let request;
  const provider = createSmsupProvider({
    config: { baseUrl: 'https://smsup.test', otpConfigId: 'otc-1', token: 'token-1', username: '', password: '', timeoutMs: 1000 },
    fetchImpl: async (url, options) => {
      request = { url, options };
      return response(200, { otpId: 'otp-1', result: true, isErrorCount: false, isExprCode: false });
    },
  });

  assert.deepEqual(await provider.verify({ providerOtpId: 'otp-1', otp: '123456' }), { verified: true });
  assert.equal(request.url, 'https://smsup.test/otp/verifyOTP');
  assert.equal(request.options.headers.Authorization, 'Bearer token-1');
  assert.deepEqual(JSON.parse(request.options.body), { otpId: 'otp-1', otpCode: '123456' });
});

test('returns a safe provider error on timeout', async () => {
  const provider = createSmsupProvider({
    config: { baseUrl: 'https://smsup.test', otpConfigId: 'otc-1', token: 'token-1', username: '', password: '', timeoutMs: 1 },
    fetchImpl: async (_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => {
        const error = new Error('aborted');
        error.name = 'AbortError';
        reject(error);
      });
    }),
  });

  await assert.rejects(provider.request({ phone: '0812345678' }), (error) => {
    assert.ok(error instanceof SmsupError);
    assert.equal(error.code, 'SMSUP_TIMEOUT');
    assert.equal(error.statusCode, 504);
    return true;
  });
});
