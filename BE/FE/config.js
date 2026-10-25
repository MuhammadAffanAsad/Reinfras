/**
 * Konfigurasi Server URL Pusat
 * Otomatis mendeteksi environment lokal atau produksi (Vercel).
 */
const SERVER_URL = (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && !window.location.hostname.includes('127.0.0.1'))
  ? window.location.origin
  : "http://localhost:3000";

if (typeof window !== 'undefined') {
  window.SERVER_URL = SERVER_URL.trim();
}
