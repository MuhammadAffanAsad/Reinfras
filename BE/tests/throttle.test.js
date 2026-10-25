const assert = require('assert');
const { createRateLimiter, generalLimiter, submissionLimiter, adminLimiter } = require('../middleware/throttle');

console.log('🧪 Memulai pengujian Throttling / Rate Limiter middleware...');

// Mock Express req, res, next
function mockReqRes(ip = '127.0.0.1') {
  const req = {
    ip,
    headers: {}
  };
  const headers = {};
  let statusCode = 200;
  let jsonBody = null;
  let nextCalled = false;

  const res = {
    setHeader(name, value) {
      headers[name.toLowerCase()] = value;
    },
    getHeader(name) {
      return headers[name.toLowerCase()];
    },
    status(code) {
      statusCode = code;
      return res;
    },
    json(body) {
      jsonBody = body;
      return res;
    }
  };

  const next = () => {
    nextCalled = true;
  };

  return { req, res, next, getNextCalled: () => nextCalled, getStatusCode: () => statusCode, getJsonBody: () => jsonBody };
}

// Test 1: Permintaan di bawah batas (max: 2) berhasil lolos (next dipanggil)
const limiter = createRateLimiter({ windowMs: 1000, max: 2, message: 'Too many requests' });

{
  const { req, res, next, getNextCalled, getStatusCode } = mockReqRes('192.168.1.10');
  limiter(req, res, next);
  assert.strictEqual(getNextCalled(), true, 'Request 1 harusnya lolos');
  assert.strictEqual(getStatusCode(), 200);
}

{
  const { req, res, next, getNextCalled, getStatusCode } = mockReqRes('192.168.1.10');
  limiter(req, res, next);
  assert.strictEqual(getNextCalled(), true, 'Request 2 harusnya lolos');
  assert.strictEqual(getStatusCode(), 200);
}

// Test 2: Permintaan ke-3 melebihi batas (max: 2) mengembalikan 429 Too Many Requests
{
  const { req, res, next, getNextCalled, getStatusCode, getJsonBody } = mockReqRes('192.168.1.10');
  limiter(req, res, next);
  assert.strictEqual(getNextCalled(), false, 'Request 3 harusnya diblokir');
  assert.strictEqual(getStatusCode(), 429);
  assert.strictEqual(getJsonBody().status, 'error');
  assert.strictEqual(getJsonBody().pesan, 'Too many requests');
  assert.strictEqual(res.getHeader('retry-after') !== undefined, true);
}

// Test 3: IP berbeda tidak terpengaruh oleh limit IP lain
{
  const { req, res, next, getNextCalled, getStatusCode } = mockReqRes('10.0.0.5');
  limiter(req, res, next);
  assert.strictEqual(getNextCalled(), true, 'IP berbeda harusnya tetap lolos');
  assert.strictEqual(getStatusCode(), 200);
}

// Test 4: Verifikasi eksistensi dan konfigurasi exported limiters (generalLimiter, submissionLimiter, adminLimiter)
{
  assert.strictEqual(typeof generalLimiter, 'function');
  assert.strictEqual(typeof submissionLimiter, 'function');
  assert.strictEqual(typeof adminLimiter, 'function');

  const { req, res, next, getNextCalled } = mockReqRes('172.16.0.1');
  generalLimiter(req, res, next);
  assert.strictEqual(getNextCalled(), true, 'generalLimiter harus mengizinkan request awal');
}

console.log('🎉 Semua pengujian Throttling / Rate Limiter middleware berhasil lolos 100%!');
