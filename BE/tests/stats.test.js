const assert = require('assert');

console.log('🧪 Memulai pengujian kalkulasi statistik laporan...');

const memoryReports = [
  { _id: '1', status: 'selesai', createdAt: new Date() },
  { _id: '2', status: 'menunggu', createdAt: new Date() },
  { _id: '3', status: 'selesai', createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) }
];

function calculateStats(reports) {
  const total = reports.length;
  const selesai = reports.filter(item => item.status === 'selesai').length;
  const proses = reports.filter(item => item.status === 'menunggu' || item.status === 'diteruskan').length;
  const startOfWeek = new Date();
  startOfWeek.setDate(startOfWeek.getDate() - 7);
  const totalMingguIni = reports.filter(item => new Date(item.createdAt) >= startOfWeek).length;
  const persen = total > 0 ? Math.round((selesai / total) * 100) : 0;

  return { total, selesai, proses, persen, totalMingguIni };
}

const stats = calculateStats(memoryReports);
assert.strictEqual(stats.total, 3);
assert.strictEqual(stats.selesai, 2);
assert.strictEqual(stats.proses, 1);
assert.strictEqual(stats.persen, 67);
assert.strictEqual(stats.totalMingguIni, 2);

console.log('✅ Semua pengujian kalkulasi statistik berhasil diverifikasi!');
