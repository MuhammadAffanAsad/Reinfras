const assert = require('assert');
const { sanitizeInput } = require('../middleware/sanitize');

console.log('🧪 Memulai pengujian pencegahan NoSQL Injection & Prototype Pollution...\n');

// Test 1: Pembersihan operator $gt, $ne, $where
const payloadNoSql = {
  kategori: 'jalan',
  keterangan: 'Lubang besar',
  injeksiOperator: {
    $ne: null,
    $gt: 0
  },
  $where: 'sleep(5000)'
};

sanitizeInput(payloadNoSql);

assert.strictEqual(payloadNoSql.kategori, 'jalan', 'Field biasa harus tetap aman');
assert.strictEqual(payloadNoSql.keterangan, 'Lubang besar', 'Field biasa harus tetap aman');
assert.strictEqual(payloadNoSql['$where'], undefined, 'Operator $where harus dihapus');
assert.deepStrictEqual(payloadNoSql.injeksiOperator, {}, 'Nested operator $ne dan $gt harus dibersihkan');
console.log('✅ Test 1 Lolos: Operator NoSQL ($gt, $ne, $where) berhasil dilumpuhkan.');

// Test 2: Pembersihan dot-notation
const payloadDot = {
  kategori: 'jembatan',
  'user.isAdmin': true
};

sanitizeInput(payloadDot);
assert.strictEqual(payloadDot['user.isAdmin'], undefined, 'Key dengan tanda titik (.) harus dihapus');
console.log('✅ Test 2 Lolos: Dot-notation injection berhasil dilumpuhkan.');

// Test 3: Pencegahan Prototype Pollution
const payloadPollution = JSON.parse('{"kategori":"Jalan Rusak","__proto__":{"polluted":true}}');
sanitizeInput(payloadPollution);
assert.strictEqual(payloadPollution.__proto__.polluted, undefined, 'Prototype pollution harus dicegah');
console.log('✅ Test 3 Lolos: Prototype pollution (__proto__) berhasil dicegah.');

// Test 4: Array di dalam payload
const payloadArray = {
  tags: ['jalan', { $regex: '.*' }, 'rusak']
};
sanitizeInput(payloadArray);
assert.deepStrictEqual(payloadArray.tags, ['jalan', {}, 'rusak'], 'Object berbahaya di dalam array berhasil dibersihkan');
console.log('✅ Test 4 Lolos: Array dengan objek berbahaya berhasil dinetralisir.');

console.log('\n🎉 Semua pengujian keamanan NoSQL Injection berhasil dengan sempurna!');
