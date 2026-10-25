const nodemailer = require('nodemailer');

const createTransporter = () => {
  const user = process.env.EMAIL_USER || process.env.SMTP_USER;
  const pass = process.env.EMAIL_PASS || process.env.SMTP_PASS;

  if (!user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 465,
    secure: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) === 465 : true,
    auth: {
      user,
      pass
    }
  });
};

const kirimEmailLaporan = async (laporanData) => {
  try {
    const transporter = createTransporter();
    if (!transporter) {
      console.warn('⚠️ Nodemailer belum dikonfigurasi (EMAIL_USER/EMAIL_PASS belum diatur di .env). Email laporan ke reinfrasmail@gmail.com dilewati.');
      return false;
    }

    const recipient = 'reinfrasmail@gmail.com';
    const { namaPelapor, judulLaporan, kategori, keterangan, alamat, koordinat, foto } = laporanData;

    let mapsUrl = null;
    if (koordinat && koordinat.latitude !== null && koordinat.longitude !== null && !isNaN(koordinat.latitude) && !isNaN(koordinat.longitude)) {
      mapsUrl = `https://www.google.com/maps?q=${koordinat.latitude},${koordinat.longitude}`;
    } else if (koordinat && koordinat.raw && typeof koordinat.raw === 'string' && koordinat.raw.includes(',')) {
      mapsUrl = `https://www.google.com/maps?q=${encodeURIComponent(koordinat.raw)}`;
    } else if (alamat) {
      mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(alamat)}`;
    }

    let attachments = [];
    if (foto && foto.data) {
      attachments.push({
        filename: foto.originalname || 'bukti-kerusakan.jpg',
        content: foto.data,
        contentType: foto.contentType || 'image/jpeg'
      });
    }

    const mailOptions = {
      from: process.env.EMAIL_USER || process.env.SMTP_USER,
      to: recipient,
      subject: `[Pengaduan Baru - Reinfras] ${judulLaporan} (${kategori})`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e1e1e1; border-radius: 8px;">
          <h2 style="color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px;">📢 Pengaduan Kerusakan Fasilitas Umum Baru</h2>
          <p>Halo <strong>Administrator</strong>,</p>
          <p>Ada pengaduan fasilitas umum baru yang masuk melalui sistem <strong>Reinfras</strong> dengan detail sebagai berikut:</p>
          <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
            <tr style="background-color: #f8f9fa;">
              <td style="padding: 10px; border: 1px solid #dee2e6; width: 35%;"><strong>Nama Pelapor</strong></td>
              <td style="padding: 10px; border: 1px solid #dee2e6;">${namaPelapor}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #dee2e6;"><strong>Judul Laporan</strong></td>
              <td style="padding: 10px; border: 1px solid #dee2e6;">${judulLaporan}</td>
            </tr>
            <tr style="background-color: #f8f9fa;">
              <td style="padding: 10px; border: 1px solid #dee2e6;"><strong>Kategori Kerusakan</strong></td>
              <td style="padding: 10px; border: 1px solid #dee2e6;"><span style="background: #e9ecef; padding: 3px 8px; border-radius: 4px; font-weight: bold; color: #495057;">${kategori}</span></td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #dee2e6;"><strong>Deskripsi Kerusakan</strong></td>
              <td style="padding: 10px; border: 1px solid #dee2e6;">${keterangan}</td>
            </tr>
            ${alamat ? `
            <tr style="background-color: #f8f9fa;">
              <td style="padding: 10px; border: 1px solid #dee2e6;"><strong>Alamat Lokasi</strong></td>
              <td style="padding: 10px; border: 1px solid #dee2e6;">${alamat}</td>
            </tr>
            ` : ''}
            ${mapsUrl ? `
            <tr>
              <td style="padding: 10px; border: 1px solid #dee2e6;"><strong>Lokasi Google Maps</strong></td>
              <td style="padding: 10px; border: 1px solid #dee2e6;"><a href="${mapsUrl}" target="_blank" style="color: #3498db; text-decoration: none; font-weight: bold;">📍 Buka Lokasi di Google Maps</a></td>
            </tr>
            ` : ''}
          </table>
          <p style="margin-top: 20px;">Bukti foto kerusakan terlampir pada email ini.</p>
          <hr style="border: none; border-top: 1px solid #dee2e6; margin: 20px 0;">
          <p style="font-size: 12px; color: #6c757d; text-align: center;">Sistem Otomatis Pengaduan Fasilitas Umum - Reinfras</p>
        </div>
      `,
      attachments
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email laporan berhasil dikirim ke ${recipient}: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error('❌ Gagal mengirim email laporan via Nodemailer:', error.message);
    return false;
  }
};

module.exports = {
  kirimEmailLaporan,
  createTransporter
};
