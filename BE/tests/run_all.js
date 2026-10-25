const path = require('path');
const { execSync } = require('child_process');

const testFiles = [
  'sanitize.test.js',
  'throttle.test.js',
  'admin_endpoints.test.js',
  'stats.test.js',
  'submit.test.js',
  'mailer.test.js'
];

console.log('🚀 Menjalankan seluruh rangkaian test backend...');

for (const file of testFiles) {
  console.log(`\n----------------------------------------`);
  console.log(`▶ Menjalankan: ${file}`);
  console.log(`----------------------------------------`);
  try {
    execSync(`node tests/${file}`, { stdio: 'inherit', cwd: path.join(__dirname, '..') });
  } catch (err) {
    console.error(`❌ Test gagal pada ${file}`);
    process.exit(1);
  }
}

console.log('\n🎉 SEMUA PENGUJIAN BACKEND BERHASIL LOLOS 100%! 🚀');
