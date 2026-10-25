const mongoose = require('mongoose');

// Aktifkan sanitasi query filter bawaan Mongoose untuk menangkal NoSQL Injection
mongoose.set('sanitizeFilter', true);

let cachedConnection = null;

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.warn('\n⚠️ [PERINGATAN KEAMANAN & KONEKSI]');
    console.warn('Variabel MONGODB_URI belum diatur di file BE/.env.');
    console.warn('Silakan buat file BE/.env dan masukkan string koneksi MongoDB Atlas Anda.');
    console.warn('Server tetap berjalan, namun operasi database akan ditunda sampai koneksi tersedia.\n');
    return;
  }

  // Jika sudah terhubung, gunakan kembali koneksi yang ada (Global Connection Pooling untuk Serverless/Workers)
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (cachedConnection) {
    return cachedConnection;
  }

  try {
    cachedConnection = mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    const conn = await cachedConnection;
    console.log(`✅ Terhubung ke MongoDB Atlas: ${conn.connection.host} / Database: ${conn.connection.name}`);
    return conn;
  } catch (error) {
    cachedConnection = null;
    console.error('❌ Gagal terhubung ke MongoDB Atlas:', error.message);
    throw error;
  }
};

module.exports = connectDB;
