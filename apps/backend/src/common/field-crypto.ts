import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

/**
 * Column-level encryption for clinical free text (PRD §7.3 / §10).
 * AES-256-GCM, key from FIELD_ENCRYPTION_KEY (64 hex chars). Ciphertext is stored as
 * "enc:v1:<iv>:<tag>:<data>" (base64), so legacy plaintext rows still read back unchanged.
 */
export const ENCRYPTED_FIELDS: Record<string, string[]> = {
  MedicalRecord: ['diagnosis', 'differentialDiagnosis', 'treatmentPlan', 'notes'],
};
const ALL_FIELDS = new Set(Object.values(ENCRYPTED_FIELDS).flat());
const PREFIX = 'enc:v1:';

function key(): Buffer | null {
  const hex = process.env.FIELD_ENCRYPTION_KEY;
  return hex && /^[0-9a-f]{64}$/i.test(hex) ? Buffer.from(hex, 'hex') : null;
}

export function encryptValue(plain: string): string {
  const k = key();
  if (!k || plain.startsWith(PREFIX)) return plain;
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', k, iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return PREFIX + [iv, cipher.getAuthTag(), data].map((b) => b.toString('base64')).join(':');
}

export function decryptValue(stored: string): string {
  if (!stored.startsWith(PREFIX)) return stored;
  const k = key();
  if (!k) return '[encrypted]';
  const [iv, tag, data] = stored.slice(PREFIX.length).split(':').map((p) => Buffer.from(p, 'base64'));
  const decipher = createDecipheriv('aes-256-gcm', k, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

export function encryptData(model: string, data: any) {
  const fields = ENCRYPTED_FIELDS[model];
  if (!fields || !data || typeof data !== 'object') return;
  for (const f of fields) {
    if (typeof data[f] === 'string') data[f] = encryptValue(data[f]);
    else if (data[f] && typeof data[f].set === 'string') data[f].set = encryptValue(data[f].set);
  }
}

/** Walks any query result (records may be nested via include) and decrypts known fields. */
export function decryptDeep(value: any, depth = 0): any {
  if (!value || typeof value !== 'object' || depth > 8) return value;
  if (value instanceof Date || Buffer.isBuffer(value)) return value;
  if (Array.isArray(value)) {
    value.forEach((v) => decryptDeep(v, depth + 1));
    return value;
  }
  for (const [k, v] of Object.entries(value)) {
    if (typeof v === 'string' && ALL_FIELDS.has(k)) value[k] = decryptValue(v);
    else if (v && typeof v === 'object') decryptDeep(v, depth + 1);
  }
  return value;
}
