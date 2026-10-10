/**
 * Browser origin(s) allowed to call the API and open realtime sockets.
 *
 * `FRONTEND_URL` is the canonical variable; `CORS_ORIGIN` is accepted as a
 * legacy alias so an existing deployment's configuration keeps working. A
 * comma-separated list is supported (e.g. production + preview origins).
 *
 * Both the HTTP CORS layer and the Socket.IO gateway must agree on this —
 * if they don't, the browser blocks the realtime handshake even though the
 * REST API works.
 */
export function allowedOrigins(): string | string[] {
  const raw = process.env.FRONTEND_URL || process.env.CORS_ORIGIN || 'http://localhost:3000';
  const origins = raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  return origins.length === 1 ? origins[0] : origins;
}
