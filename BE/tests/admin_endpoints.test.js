const assert = require('assert');

console.log('🧪 Memulai pengujian logika endpoint Admin (Update Status & Hapus Laporan)...');

// Mock memory store untuk laporan
let testMemoryReports = [
  {
    _id: '654321654321654321654321',
    nomorLaporan: 'GIB-1001',
    namaPelapor: 'Budi Santoso',
    judulLaporan: 'Jalan Rusak di Plaju',
    kategori: 'Jalan Rusak',
    status: 'menunggu',
    createdAt: new Date()
  },
  {
    _id: '654321654321654321654322',
    nomorLaporan: 'GIB-1002',
    namaPelapor: 'Siti Rahma',
    judulLaporan: 'Lampu Jalan Padam di Sukarami',
    kategori: 'Lampu Jalan',
    status: 'diteruskan',
    createdAt: new Date()
  }
];

const validStatuses = ['menunggu', 'diteruskan', 'selesai', 'ditolak'];

function updateReportStatus(reports, id, newStatus) {
  const normalized = typeof newStatus === 'string' ? newStatus.trim().toLowerCase() : '';
  if (!validStatuses.includes(normalized)) {
    throw new Error(`Status tidak valid. Pilihan status: ${validStatuses.join(', ')}`);
  }

  const idx = reports.findIndex(r => r._id === id || r.nomorLaporan === id);
  if (idx === -1) {
    return null;
  }

  reports[idx].status = normalized;
  reports[idx].updatedAt = new Date();
  return reports[idx];
}

function deleteReport(reports, id) {
  const idx = reports.findIndex(r => r._id === id || r.nomorLaporan === id);
  if (idx === -1) {
    return false;
  }
  reports.splice(idx, 1);
  return true;
}

// 1. Test Validasi Status
assert.throws(() => {
  updateReportStatus(testMemoryReports, 'GIB-1001', 'status_asal_asalan');
}, /Status tidak valid/);
console.log('✅ Test 1 Lolos: Status tidak valid ditolak dengan tepat.');

// 2. Test Update Status dengan nomorLaporan
const updated1 = updateReportStatus(testMemoryReports, 'GIB-1001', 'selesai');
assert.strictEqual(updated1.status, 'selesai');
assert.strictEqual(testMemoryReports[0].status, 'selesai');
console.log('✅ Test 2 Lolos: Update status via nomorLaporan berhasil.');

// 3. Test Update Status dengan _id
const updated2 = updateReportStatus(testMemoryReports, '654321654321654321654322', 'menunggu');
assert.strictEqual(updated2.status, 'menunggu');
assert.strictEqual(testMemoryReports[1].status, 'menunggu');
console.log('✅ Test 3 Lolos: Update status via _id berhasil.');

// 4. Test Update Status untuk ID tidak ada
const notFound = updateReportStatus(testMemoryReports, 'GIB-9999', 'selesai');
assert.strictEqual(notFound, null);
console.log('✅ Test 4 Lolos: Update laporan tidak ditemukan menghasilkan null (404).');

// 5. Test Hapus Laporan via nomorLaporan
const deleted1 = deleteReport(testMemoryReports, 'GIB-1001');
assert.strictEqual(deleted1, true);
assert.strictEqual(testMemoryReports.length, 1);
assert.strictEqual(testMemoryReports.find(r => r.nomorLaporan === 'GIB-1001'), undefined);
console.log('✅ Test 5 Lolos: Hapus laporan via nomorLaporan berhasil.');

// 6. Test Hapus Laporan via _id
const deleted2 = deleteReport(testMemoryReports, '654321654321654321654322');
assert.strictEqual(deleted2, true);
assert.strictEqual(testMemoryReports.length, 0);
console.log('✅ Test 6 Lolos: Hapus laporan via _id berhasil.');

// 7. Test Hapus Laporan untuk ID yang sudah terhapus
const deleteNotFound = deleteReport(testMemoryReports, 'GIB-1001');
assert.strictEqual(deleteNotFound, false);
console.log('✅ Test 7 Lolos: Hapus laporan tidak ditemukan menghasilkan false (404).');

console.log('🎉 Semua pengujian logika Admin Endpoint berhasil lolos 100%!');
