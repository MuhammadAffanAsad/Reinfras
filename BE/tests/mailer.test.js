const assert = require('assert');
const { createTransporter, kirimEmailLaporan } = require('../utils/mailer');

console.log('🧪 Memulai pengujian Nodemailer mailer.js...');

// Test 1: createTransporter returns null when credentials are missing
const originalUser = process.env.EMAIL_USER;
const originalPass = process.env.EMAIL_PASS;
delete process.env.EMAIL_USER;
delete process.env.EMAIL_PASS;

const transporterWithoutCreds = createTransporter();
assert.strictEqual(transporterWithoutCreds, null, 'Transporter harus bernilai null jika kredensial email belum diatur');
console.log('✅ Test 1 Lolos: Transporter menangani kredensial kosong dengan benar.');

// Test 2: kirimEmailLaporan handles missing credentials gracefully without throwing
(async () => {
  const result = await kirimEmailLaporan({
    namaPelapor: 'Budi Test',
    judulLaporan: 'Jalan Berlubang',
    kategori: 'Jalan Rusak',
    keterangan: 'Ada lubang besar di jalan utama.',
    foto: {
      data: Buffer.from('fake-image'),
      contentType: 'image/jpeg',
      originalname: 'test.jpg'
    }
  });
  assert.strictEqual(result, false, 'kirimEmailLaporan harus mengembalikan false jika belum dikonfigurasi');
  console.log('✅ Test 2 Lolos: kirimEmailLaporan menangani ketiadaan kredensial dengan aman.');

  // Restore env
  if (originalUser) process.env.EMAIL_USER = originalUser;
  if (originalPass) process.env.EMAIL_PASS = originalPass;

  console.log('🎉 Semua pengujian mailer berhasil lolos 100%!');
})();
