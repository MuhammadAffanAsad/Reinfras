const mongoose = require('mongoose');

const laporanSchema = new mongoose.Schema(
  {
    nomorLaporan: {
      type: String,
      unique: true,
      index: true
    },
    namaPelapor: {
      type: String,
      required: [true, 'Nama pelapor wajib diisi'],
      default: 'Warga Pelapor',
      trim: true,
      maxlength: [100, 'Nama pelapor maksimal 100 karakter']
    },
    judulLaporan: {
      type: String,
      required: [true, 'Judul laporan wajib diisi'],
      default: 'Laporan Kerusakan',
      trim: true,
      maxlength: [150, 'Judul laporan maksimal 150 karakter']
    },
    kategori: {
      type: String,
      required: [true, 'Kategori kerusakan wajib diisi'],
      enum: [
        'Jalan Rusak',
        'Trotoar',
        'Saluran Air',
        'Lampu Jalan',
        'Kelistrikan',
        'Air Bersih',
        'Jembatan',
        'Rambu dan Lampu Lalu Lintas',
        'Sampah Umum',
        'Taman dan Ruang Terbuka',
        'Lainnya'
      ],
      trim: true
    },
    keterangan: {
      type: String,
      required: [true, 'Keterangan kerusakan wajib diisi'],
      trim: true,
      maxlength: [2000, 'Keterangan maksimal 2000 karakter']
    },
    alamat: {
      type: String,
      trim: true,
      default: ''
    },
    koordinat: {
      latitude: {
        type: Number,
        default: null
      },
      longitude: {
        type: Number,
        default: null
      },
      raw: {
        type: String,
        default: ''
      }
    },
    foto: {
      data: {
        type: Buffer,
        required: [true, 'Bukti foto wajib disertakan']
      },
      contentType: {
        type: String,
        required: [true, 'Tipe file foto wajib disertakan']
      },
      originalname: {
        type: String,
        default: ''
      },
      size: {
        type: Number,
        default: 0
      }
    },
    fotoSelesai: {
      data: {
        type: Buffer,
        default: null
      },
      contentType: {
        type: String,
        default: ''
      },
      originalname: {
        type: String,
        default: ''
      },
      size: {
        type: Number,
        default: 0
      }
    },
    metadataLokasi: {
      akurasi: {
        type: Number,
        default: null
      },
      rawDox: {
        type: mongoose.Schema.Types.Mixed,
        default: null
      }
    },
    status: {
      type: String,
      enum: ['menunggu', 'diteruskan', 'selesai', 'ditolak'],
      default: 'menunggu'
    }
  },
  {
    timestamps: true,
    // Strict schema mencegah penyisipan property tidak terdefinisi (NoSQL mass assignment)
    strict: true
  }
);

// Tambahkan Index untuk mempercepat query / latensi database
laporanSchema.index({ createdAt: -1 });
laporanSchema.index({ status: 1 });
laporanSchema.index({ kategori: 1 });

// Helper pra-penyimpanan untuk generate nomor laporan acak yang unik (contoh: GIB-1042)
laporanSchema.pre('save', async function () {
  if (!this.nomorLaporan) {
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    this.nomorLaporan = `GIB-${randomDigits}`;
  }
  if (!this.namaPelapor) {
    this.namaPelapor = 'Warga Pelapor';
  }
  if (!this.judulLaporan) {
    this.judulLaporan = `${this.kategori} di ${this.alamat || 'Palembang'}`;
  }
});

const Laporan = mongoose.model('Laporan', laporanSchema);

module.exports = Laporan;
