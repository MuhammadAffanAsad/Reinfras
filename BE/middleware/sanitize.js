/**
 * Middleware Pertahanan Siber: NoSQL Injection & Prototype Pollution Sanitizer
 * 
 * Melindungi Express dari serangan NoSQL operator injection (seperti $gt, $ne, $regex, $where)
 * serta serangan prototype pollution (__proto__, constructor) dengan membersihkan atau membuang
 * key yang diawali '$' atau mengandung titik '.' dari req.body, req.params, dan req.query.
 */

function sanitizeInput(payload) {
  if (!payload || typeof payload !== 'object') {
    return payload;
  }

  if (Array.isArray(payload)) {
    for (let i = 0; i < payload.length; i++) {
      payload[i] = sanitizeInput(payload[i]);
    }
    return payload;
  }

  for (const key of Object.keys(payload)) {
    // 1. Blokir Prototype Pollution
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      delete payload[key];
      continue;
    }

    // 2. Blokir MongoDB Operators ($) dan dot-notation (.)
    if (key.startsWith('$') || key.includes('.')) {
      delete payload[key];
      continue;
    }

    // 3. Rekursif jika value berupa object / array
    if (typeof payload[key] === 'object' && payload[key] !== null) {
      sanitizeInput(payload[key]);
    }
  }

  return payload;
}

function noSqlInjectionSanitizer(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    sanitizeInput(req.body);
  }
  if (req.params && typeof req.params === 'object') {
    sanitizeInput(req.params);
  }
  if (req.query && typeof req.query === 'object') {
    try {
      sanitizeInput(req.query);
    } catch {
      // Menangani getter query pada Express 5 jika bersifat read-only
    }
  }

  next();
}

module.exports = {
  noSqlInjectionSanitizer,
  sanitizeInput
};
