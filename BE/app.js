require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const { noSqlInjectionSanitizer } = require('./middleware/sanitize');
const { generalLimiter, submissionLimiter, adminLimiter } = require('./middleware/throttle');
const Laporan = require('./models/Laporan');
const { kirimEmailLaporan } = require('./utils/mailer');

const app = express();
const PORT = process.env.PORT || 3000;

// In-memory reports store for fallback when MongoDB is not connected
const memoryReports = [];

// 2. Middleware Dasar & Keamanan
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'FE')));

// Middleware Sanitasi NoSQL Injection untuk JSON & URL-encoded request
app.use(noSqlInjectionSanitizer);
app.use(generalLimiter);

// 3. Konfigurasi Multer (Memory Storage & Validasi File)
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // Batas maksimal 5 MB sesuai form
  },
  fileFilter: (req, file, cb) => {
    // Validasi MIME type foto untuk mencegah unggahan berkas berbahaya (executable, script, dll)
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Format file tidak didukung. Harap unggah foto dengan format JPG, PNG, atau WEBP.'));
    }
  }
});

// ==========================================
// ROUTES
// ==========================================

// Endpoint Root / Health Check
app.get('/', (req, res) => {
  res.json({
    status: 'sukses',
    pesan: 'API Pengaduan Reinfras Aktif',
    database: mongoose.connection.readyState === 1 ? 'Terhubung' : 'Belum Terhubung'
  });
});

// Endpoint Buat Laporan (POST /)
app.post('/', submissionLimiter, upload.single('foto'), async (req, res) => {
  try {
    // Sanitasi kembali req.body setelah diproses oleh multer multipart parser
    if (req.body) {
      const { sanitizeInput } = require('./middleware/sanitize');
      sanitizeInput(req.body);
    }

    const { namaPelapor, judulLaporan, kategori, keterangan, alamat, koordinat, dox } = req.body || {};
    const foto = req.file;

    // Validasi field utama
    if (!namaPelapor || !judulLaporan || !kategori || !keterangan || !foto) {
      return res.status(400).json({
        status: 'error',
        pesan: 'Nama pelapor, judul laporan, kategori, keterangan, dan bukti foto wajib diisi!'
      });
    }

    // Parsing koordinat secara eksplisit & aman dari NoSQL injection
    let latitude = null;
    let longitude = null;
    if (typeof koordinat === 'string' && koordinat.includes(',')) {
      const parts = koordinat.split(',').map((val) => parseFloat(val.trim()));
      if (!isNaN(parts[0]) && !isNaN(parts[1])) {
        latitude = parts[0];
        longitude = parts[1];
      }
    }

    // Ekstraksi data lokasi / dox
    let parsedDox = null;
    let akurasi = null;
    if (dox) {
      if (typeof dox === 'string') {
        const doxParts = dox.split(',').map((val) => parseFloat(val.trim()));
        if (doxParts.length >= 3 && !isNaN(doxParts[2])) {
          akurasi = doxParts[2];
        }
        parsedDox = doxParts;
      } else {
        parsedDox = dox;
      }
    }

    // Persiapkan data laporan tanpa menggunakan spread operator langsung dari req.body (Whitelisting)
    const laporanData = {
      namaPelapor: String(namaPelapor).trim(),
      judulLaporan: String(judulLaporan).trim(),
      kategori: String(kategori).trim(),
      keterangan: String(keterangan).trim(),
      alamat: alamat ? String(alamat).trim() : '',
      koordinat: {
        latitude,
        longitude,
        raw: typeof koordinat === 'string' ? koordinat : ''
      },
      foto: {
        data: foto.buffer,
        contentType: foto.mimetype,
        originalname: foto.originalname,
        size: foto.size
      },
      metadataLokasi: {
        akurasi,
        rawDox: parsedDox
      }
    };

    // Jika database sudah terhubung, simpan ke MongoDB Atlas
    if (mongoose.connection.readyState === 1) {
      try {
        const laporanBaru = new Laporan(laporanData);
        const hasil = await laporanBaru.save();

        try {
          await kirimEmailLaporan(laporanData);
        } catch (emailErr) {
          console.error('⚠️ Gagal mengirim email notifikasi:', emailErr.message);
        }

        return res.status(201).json({
          status: 'sukses',
          pesan: 'Laporan berhasil disimpan ke database!',
          data: {
            id: hasil._id,
            nomorLaporan: hasil.nomorLaporan,
            namaPelapor: hasil.namaPelapor,
            judulLaporan: hasil.judulLaporan,
            kategori: hasil.kategori,
            keterangan: hasil.keterangan,
            createdAt: hasil.createdAt
          }
        });
      } catch (dbError) {
        console.warn('⚠️ Gagal menyimpan ke database Atlas (timeout/koneksi), beralih ke fallback memori:', dbError.message);
      }
    }

    // Fallback jika MONGODB_URI belum diisi atau gagal
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    const nomorLaporan = `GIB-${randomDigits}`;
    const generatedId = new mongoose.Types.ObjectId();
    const memItem = {
      _id: generatedId,
      nomorLaporan,
      namaPelapor: laporanData.namaPelapor,
      judulLaporan: laporanData.judulLaporan || `${laporanData.kategori} di ${laporanData.alamat || 'Palembang'}`,
      kategori: laporanData.kategori,
      keterangan: laporanData.keterangan,
      alamat: laporanData.alamat,
      koordinat: laporanData.koordinat,
      foto: laporanData.foto,
      metadataLokasi: laporanData.metadataLokasi,
      status: 'menunggu',
      createdAt: new Date()
    };
    memoryReports.unshift(memItem);

    try {
      await kirimEmailLaporan(laporanData);
    } catch (emailErr) {
      console.error('⚠️ Gagal mengirim email notifikasi:', emailErr.message);
    }

    console.log('📌 Laporan diterima di memori (MongoDB belum terhubung/fallback):', {
      nomorLaporan: memItem.nomorLaporan,
      namaPelapor: memItem.namaPelapor,
      judulLaporan: memItem.judulLaporan,
      kategori: memItem.kategori
    });

    return res.status(201).json({
      status: 'sukses',
      pesan: 'Data berhasil diterima di memori server (Database belum tersambung)',
      data: {
        id: memItem._id,
        nomorLaporan: memItem.nomorLaporan,
        namaPelapor: memItem.namaPelapor,
        judulLaporan: memItem.judulLaporan,
        kategori: memItem.kategori,
        keterangan: memItem.keterangan,
        createdAt: memItem.createdAt
      }
    });
    } catch (error) {
    console.error('❌ Error Detail saat menyimpan laporan:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });

    // Tangani validasi error mongoose
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        status: 'error',
        pesan: messages.join(', ')
      });
    }

    return res.status(500).json({
      status: 'error',
      pesan: 'Terjadi kesalahan pada server saat memproses laporan.'
    });
  }
});

// Endpoint Statistik (GET /stats & GET /statistik)
app.get(['/stats', '/statistik'], async (req, res) => {
  try {
    let dbTotal = 0;
    let dbSelesai = 0;
    let dbProses = 0;
    let dbMingguIni = 0;

    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - 7);

    if (mongoose.connection.readyState === 1) {
      try {
        const { trusted } = mongoose;
        const startOfWeek = new Date();
        startOfWeek.setDate(startOfWeek.getDate() - 7);

        const [totalCount, selesaiCount, prosesCount, mingguIniCount] = await Promise.all([
          Laporan.countDocuments(),
          Laporan.countDocuments({ status: 'selesai' }),
          Laporan.countDocuments({ status: trusted({ $in: ['menunggu', 'diteruskan'] }) }),
          Laporan.countDocuments({ createdAt: trusted({ $gte: startOfWeek }) })
        ]);
        dbTotal = totalCount;
        dbSelesai = selesaiCount;
        dbProses = prosesCount;
        dbMingguIni = mingguIniCount;
      } catch (err) {
        console.warn('⚠️ Gagal mengambil statistik dari DB:', err.message);
      }
    }

    const memTotal = memoryReports.length;
    const memSelesai = memoryReports.filter(item => item.status === 'selesai').length;
    const memProses = memoryReports.filter(item => item.status === 'menunggu' || item.status === 'diteruskan' || !item.status).length;
    const memMingguIni = memoryReports.filter(item => new Date(item.createdAt) >= startOfWeek).length;

    const total = dbTotal + memTotal;
    const selesai = dbSelesai + memSelesai;
    const proses = dbProses + memProses;
    const totalMingguIni = Math.max(dbMingguIni, memMingguIni);
    const persen = total > 0 ? Math.round((selesai / total) * 100) : 0;

    res.json({
      status: 'sukses',
      data: {
        total,
        selesai,
        proses,
        persen,
        totalMingguIni
      }
    });
  } catch (error) {
    console.error('Error mengambil statistik:', error);
    res.status(500).json({
      status: 'error',
      pesan: 'Gagal mengambil data statistik.'
    });
  }
});

// Endpoint untuk mengambil feed laporan (GET /laporan)
app.get('/laporan', async (req, res) => {
  try {
    let daftarLaporan = [];
    let totalMingguIni = 0;
    let dbTotal = 0;
    let dbSelesai = 0;
    let dbProses = 0;

    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - 7);

    if (mongoose.connection.readyState === 1) {
      try {
        const { trusted } = mongoose;
        const startOfWeek = new Date();
        startOfWeek.setDate(startOfWeek.getDate() - 7);

        const [totalCount, selesaiCount, prosesCount, mingguIniCount, dbLaporan] = await Promise.all([
          Laporan.countDocuments(),
          Laporan.countDocuments({ status: 'selesai' }),
          Laporan.countDocuments({ status: trusted({ $in: ['menunggu', 'diteruskan'] }) }),
          Laporan.countDocuments({ createdAt: trusted({ $gte: startOfWeek }) }),
          Laporan.find()
            .select('-foto.data -fotoSelesai.data')
            .sort({ createdAt: -1 })
            .limit(50)
            .lean()
        ]);
        dbTotal = totalCount;
        dbSelesai = selesaiCount;
        dbProses = prosesCount;
        totalMingguIni = mingguIniCount;
        daftarLaporan = dbLaporan;
      } catch (err) {
        console.warn('⚠️ Gagal mengambil dari DB Atlas, menggunakan data memori:', err.message);
      }
    }

    const memFeedItems = memoryReports.map(item => ({
      _id: item._id,
      nomorLaporan: item.nomorLaporan,
      namaPelapor: item.namaPelapor,
      judulLaporan: item.judulLaporan,
      kategori: item.kategori,
      keterangan: item.keterangan,
      alamat: item.alamat,
      koordinat: item.koordinat,
      status: item.status,
      createdAt: item.createdAt
    }));

    const combined = [...memFeedItems, ...daftarLaporan];
    const memMingguIni = memoryReports.filter(item => new Date(item.createdAt) >= startOfWeek).length;
    const finalTotalMingguIni = Math.max(totalMingguIni, memMingguIni);

    const memTotal = memoryReports.length;
    const memSelesai = memoryReports.filter(item => item.status === 'selesai').length;
    const memProses = memoryReports.filter(item => item.status === 'menunggu' || item.status === 'diteruskan' || !item.status).length;

    const total = dbTotal + memTotal;
    const selesai = dbSelesai + memSelesai;
    const proses = dbProses + memProses;
    const persen = total > 0 ? Math.round((selesai / total) * 100) : 0;

    const feed = combined.map((item) => {
      const hasFotoSelesai = (item.fotoSelesai && (item.fotoSelesai.data || item.fotoSelesai.size > 0));
      return {
        id: item.nomorLaporan || item._id,
        _id: item._id,
        nomorLaporan: item.nomorLaporan,
        namaPelapor: item.namaPelapor,
        judulLaporan: item.judulLaporan || `${item.kategori} di ${item.alamat || 'Palembang'}`,
        kategori: item.kategori,
        keterangan: item.keterangan,
        alamat: item.alamat,
        koordinat: item.koordinat,
        status: item.status || 'menunggu',
        createdAt: item.createdAt,
        fotoUrl: `/laporan/${item._id}/foto`,
        fotoSelesaiUrl: hasFotoSelesai ? `/laporan/${item._id}/foto-selesai` : null
      };
    });

    res.json({
      status: 'sukses',
      total: feed.length,
      totalMingguIni: finalTotalMingguIni,
      stats: {
        total,
        selesai,
        proses,
        persen
      },
      data: feed
    });
  } catch (error) {
    console.error('Error mengambil laporan:', error);
    res.status(500).json({
      status: 'error',
      pesan: 'Gagal mengambil data laporan.'
    });
  }
});

// Endpoint untuk menyajikan foto langsung dari buffer MongoDB atau memory (GET /laporan/:id/foto)
app.get('/laporan/:id/foto', async (req, res) => {
  try {
    const id = req.params.id;

    // 1. Cek di memoryReports terlebih dahulu jika bukan 24-hex ObjectId atau jika ditemukan
    const memFound = memoryReports.find(item => (item._id && item._id.toString() === id) || item.nomorLaporan === id);
    if (memFound && memFound.foto && memFound.foto.data) {
      res.set({
        'Content-Type': memFound.foto.contentType || 'image/jpeg',
        'Content-Length': memFound.foto.data.length,
        'Cache-Control': 'public, max-age=86400'
      });
      return res.send(memFound.foto.data);
    }

    // 2. Cek di Database jika terhubung dan ID valid 24-hex ObjectId
    if (mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(id) && /^[0-9a-fA-F]{24}$/.test(id)) {
      const laporan = await Laporan.findById(id).select('foto');
      if (laporan && laporan.foto && laporan.foto.data) {
        res.set({
          'Content-Type': laporan.foto.contentType,
          'Content-Length': laporan.foto.data.length,
          'Cache-Control': 'public, max-age=86400' // Cache 1 hari
        });
        return res.send(laporan.foto.data);
      }
    }

    return res.status(404).json({
      status: 'error',
      pesan: 'Foto tidak ditemukan.'
    });
  } catch (error) {
    console.error('Error mengambil foto:', error);
    res.status(500).json({
      status: 'error',
      pesan: 'Gagal mengambil foto laporan.'
    });
  }
});

// Endpoint Mengubah Status Laporan (PATCH /laporan/:id/status & PUT /laporan/:id/status)
const validStatuses = ['menunggu', 'diteruskan', 'selesai', 'ditolak'];
app.all(['/laporan/:id/status'], adminLimiter, upload.single('fotoSelesai'), async (req, res, next) => {
  if (req.method !== 'PATCH' && req.method !== 'PUT') return next();
  try {
    const id = req.params.id;
    if (req.body) {
      const { sanitizeInput } = require('./middleware/sanitize');
      sanitizeInput(req.body);
    }
    const { status } = req.body || {};
    const fotoSelesai = req.file;

    const normalizedStatus = typeof status === 'string' ? status.trim().toLowerCase() : '';

    if (!validStatuses.includes(normalizedStatus)) {
      return res.status(400).json({
        status: 'error',
        pesan: `Status tidak valid. Pilihan status yang tersedia: ${validStatuses.join(', ')}`
      });
    }

    let updateData = { status: normalizedStatus };
    if (fotoSelesai) {
      updateData.fotoSelesai = {
        data: fotoSelesai.buffer,
        contentType: fotoSelesai.mimetype,
        originalname: fotoSelesai.originalname,
        size: fotoSelesai.size
      };
    }

    let updatedReport = null;

    // 1. Perbarui di MongoDB jika terhubung
    if (mongoose.connection.readyState === 1) {
      try {
        let query;
        if (mongoose.Types.ObjectId.isValid(id) && /^[0-9a-fA-F]{24}$/.test(id)) {
          query = { $or: [{ _id: id }, { nomorLaporan: id }] };
        } else {
          query = { nomorLaporan: id };
        }

        const doc = await Laporan.findOneAndUpdate(
          query,
          { $set: updateData },
          { new: true, runValidators: true }
        ).select('-foto.data -fotoSelesai.data');

        if (doc) {
          updatedReport = doc.toObject ? doc.toObject() : doc;
        }
      } catch (dbErr) {
        console.warn('⚠️ Gagal update status di MongoDB Atlas:', dbErr.message);
      }
    }

    // 2. Perbarui di memoryReports (sinkronisasi memori / fallback)
    const memIndex = memoryReports.findIndex(item => (item._id && item._id.toString() === id) || item.nomorLaporan === id);
    if (memIndex !== -1) {
      memoryReports[memIndex].status = normalizedStatus;
      if (fotoSelesai) {
        memoryReports[memIndex].fotoSelesai = updateData.fotoSelesai;
      }
      if (!updatedReport) {
        const mem = memoryReports[memIndex];
        updatedReport = {
          id: mem.nomorLaporan || mem._id,
          nomorLaporan: mem.nomorLaporan,
          namaPelapor: mem.namaPelapor,
          judulLaporan: mem.judulLaporan,
          kategori: mem.kategori,
          status: mem.status,
          updatedAt: new Date()
        };
      }
    }

    if (!updatedReport) {
      return res.status(404).json({
        status: 'error',
        pesan: 'Laporan tidak ditemukan.'
      });
    }

    return res.json({
      status: 'sukses',
      pesan: `Status laporan berhasil diperbarui menjadi '${normalizedStatus}'.`,
      data: updatedReport
    });
  } catch (error) {
    console.error('Error saat memperbarui status laporan:', error);
    return res.status(500).json({
      status: 'error',
      pesan: 'Terjadi kesalahan pada server saat memperbarui status laporan.'
    });
  }
});

// Endpoint untuk menyajikan foto selesai (GET /laporan/:id/foto-selesai)
app.get('/laporan/:id/foto-selesai', async (req, res) => {
  try {
    const id = req.params.id;

    const memFound = memoryReports.find(item => (item._id && item._id.toString() === id) || item.nomorLaporan === id);
    if (memFound && memFound.fotoSelesai && memFound.fotoSelesai.data) {
      res.set({
        'Content-Type': memFound.fotoSelesai.contentType || 'image/jpeg',
        'Content-Length': memFound.fotoSelesai.data.length,
        'Cache-Control': 'public, max-age=86400'
      });
      return res.send(memFound.fotoSelesai.data);
    }

    if (mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(id) && /^[0-9a-fA-F]{24}$/.test(id)) {
      const laporan = await Laporan.findById(id).select('fotoSelesai');
      if (laporan && laporan.fotoSelesai && laporan.fotoSelesai.data) {
        res.set({
          'Content-Type': laporan.fotoSelesai.contentType,
          'Content-Length': laporan.fotoSelesai.data.length,
          'Cache-Control': 'public, max-age=86400'
        });
        return res.send(laporan.fotoSelesai.data);
      }
    }

    return res.status(404).json({
      status: 'error',
      pesan: 'Foto selesai tidak ditemukan.'
    });
  } catch (error) {
    console.error('Error mengambil foto selesai:', error);
    res.status(500).json({
      status: 'error',
      pesan: 'Gagal mengambil foto selesai laporan.'
    });
  }
});

// Endpoint Unggah Foto Selesai (PATCH /laporan/:id/foto-selesai)
app.patch('/laporan/:id/foto-selesai', adminLimiter, upload.single('fotoSelesai'), async (req, res) => {
  try {
    const id = req.params.id;
    const fotoSelesai = req.file;

    if (!fotoSelesai) {
      return res.status(400).json({ status: 'error', pesan: 'File foto selesai wajib disertakan.' });
    }

    const fotoData = {
      data: fotoSelesai.buffer,
      contentType: fotoSelesai.mimetype,
      originalname: fotoSelesai.originalname,
      size: fotoSelesai.size
    };

    let updated = false;
    if (mongoose.connection.readyState === 1) {
      try {
        let query = mongoose.Types.ObjectId.isValid(id) ? { $or: [{ _id: id }, { nomorLaporan: id }] } : { nomorLaporan: id };
        const doc = await Laporan.findOneAndUpdate(query, { $set: { fotoSelesai: fotoData, status: 'selesai' } }, { new: true });
        if (doc) updated = true;
      } catch (err) {
        console.warn('Gagal update foto selesai di DB:', err.message);
      }
    }

    const memIndex = memoryReports.findIndex(item => (item._id && item._id.toString() === id) || item.nomorLaporan === id);
    if (memIndex !== -1) {
      memoryReports[memIndex].fotoSelesai = fotoData;
      memoryReports[memIndex].status = 'selesai';
      updated = true;
    }

    if (!updated) {
      return res.status(404).json({ status: 'error', pesan: 'Laporan tidak ditemukan.' });
    }

    return res.json({ status: 'sukses', pesan: 'Foto bukti pengerjaan berhasil diunggah.' });
  } catch (error) {
    console.error('Error mengunggah foto selesai:', error);
    res.status(500).json({ status: 'error', pesan: 'Gagal mengunggah foto bukti pengerjaan.' });
  }
});

// Endpoint Menghapus Laporan (DELETE /laporan/:id)
app.delete('/laporan/:id', adminLimiter, async (req, res) => {
  try {
    const id = req.params.id;
    let deleted = false;

    // 1. Hapus dari MongoDB jika terhubung
    if (mongoose.connection.readyState === 1) {
      try {
        let query;
        if (mongoose.Types.ObjectId.isValid(id) && /^[0-9a-fA-F]{24}$/.test(id)) {
          query = { $or: [{ _id: id }, { nomorLaporan: id }] };
        } else {
          query = { nomorLaporan: id };
        }

        const doc = await Laporan.findOneAndDelete(query);
        if (doc) {
          deleted = true;
        }
      } catch (dbErr) {
        console.warn('⚠️ Gagal menghapus laporan di MongoDB Atlas:', dbErr.message);
      }
    }

    // 2. Hapus dari memoryReports
    const memIndex = memoryReports.findIndex(item => (item._id && item._id.toString() === id) || item.nomorLaporan === id);
    if (memIndex !== -1) {
      memoryReports.splice(memIndex, 1);
      deleted = true;
    }

    if (!deleted) {
      return res.status(404).json({
        status: 'error',
        pesan: 'Laporan tidak ditemukan atau sudah dihapus.'
      });
    }

    return res.json({
      status: 'sukses',
      pesan: 'Laporan berhasil dihapus.'
    });
  } catch (error) {
    console.error('Error saat menghapus laporan:', error);
    return res.status(500).json({
      status: 'error',
      pesan: 'Terjadi kesalahan pada server saat menghapus laporan.'
    });
  }
});

// Centralized Error Handler (Menangani Multer limit error dll)
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        status: 'error',
        pesan: 'Ukuran foto terlalu besar. Maksimal 5 MB.'
      });
    }
    return res.status(400).json({
      status: 'error',
      pesan: `Kesalahan unggah file: ${err.message}`
    });
  }

  if (err) {
    return res.status(400).json({
      status: 'error',
      pesan: err.message || 'Terjadi kesalahan pada request.'
    });
  }

  next();
});

// Menjalankan server (atau diekspor untuk Vercel Serverless)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
  });
}

module.exports = app;
