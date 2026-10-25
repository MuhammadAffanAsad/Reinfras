/**
 * Middleware Pertahanan Siber: Throttling / Rate Limiter
 * 
 * Melindungi server Express dari serangan DoS, spam submission, dan brute force
 * dengan membatasi jumlah request dari IP address yang sama dalam kurun waktu tertentu.
 */

function createRateLimiter(options = {}) {
  const windowMs = options.windowMs || 15 * 60 * 1000; // Default 15 menit
  const max = options.max || 100; // Default 100 request per window
  const message = options.message || 'Terlalu banyak permintaan dari IP ini, silakan coba lagi beberapa saat.';
  
  const hits = new Map();

  // Periodic cleanup to prevent memory growth
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [ip, data] of hits.entries()) {
      if (now > data.resetTime) {
        hits.delete(ip);
      }
    }
  }, windowMs);
  
  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }

  return function rateLimitMiddleware(req, res, next) {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const now = Date.now();

    let record = hits.get(ip);

    if (!record || now > record.resetTime) {
      record = {
        count: 0,
        resetTime: now + windowMs
      };
      hits.set(ip, record);
    }

    record.count++;

    const remaining = Math.max(0, max - record.count);
    const resetTimeSeconds = Math.ceil((record.resetTime - now) / 1000);

    if (res.setHeader) {
      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', remaining);
      res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000));
    }

    if (record.count > max) {
      if (res.setHeader) {
        res.setHeader('Retry-After', resetTimeSeconds);
      }
      return res.status(429).json({
        status: 'error',
        pesan: message
      });
    }

    next();
  };
}

const generalLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 200, // 200 request per 15 menit untuk API umum
  message: 'Terlalu banyak permintaan ke server. Silakan coba lagi nanti.'
});

const submissionLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000, // 10 menit
  max: 10, // Maksimal 10 laporan per 10 menit per IP untuk mencegah spam
  message: 'Anda terlalu sering mengirimkan laporan. Harap tunggu beberapa saat sebelum mengirim laporan baru.'
});

const adminLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000, // 10 menit
  max: 30, // Maksimal 30 request per 10 menit untuk operasi admin
  message: 'Terlalu banyak percobaan tindakan admin dari IP ini. Harap tunggu beberapa saat.'
});

module.exports = {
  createRateLimiter,
  generalLimiter,
  submissionLimiter,
  adminLimiter
};
