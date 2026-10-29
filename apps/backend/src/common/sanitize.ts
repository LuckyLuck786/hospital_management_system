const SENSITIVE_KEY = /pass(word)?|token|otp|secret|authorization|cookie|signature|cardnumber|cvv/i;

/** Deep-copies a value, replacing sensitive fields so they never reach logs or the audit table. */
export function redact(value: unknown, depth = 0): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (depth > 6) return '[truncated]';
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = SENSITIVE_KEY.test(k) ? '[REDACTED]' : redact(v, depth + 1);
  }
  return out;
}

/** Strips OTP/token-looking values out of free-form log lines. */
export function sanitizeLogLine(line: string): string {
  return line
    .replace(/(otp|token|password|secret)(["'\s:=]+)([^\s"',}]+)/gi, '$1$2[REDACTED]')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, 'Bearer [REDACTED]');
}
