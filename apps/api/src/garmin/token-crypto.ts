import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * Criptografia simétrica AES-256-GCM para os segredos Garmin (token OAuth,
 * senha, estado de MFA). Formato do ciphertext (base64):
 *
 *   [ versão(1) | iv(12) | authTag(16) | ciphertext(n) ]
 *
 * A chave (GARMIN_TOKEN_KEY) é um valor base64 de 32 bytes guardado no secret
 * store do host — NUNCA no banco. Assim, um dump do Postgres não revela tokens.
 * O byte de versão permite rotação futura de chave.
 */
const VERSION = 0x01;
const IV_LEN = 12;
const TAG_LEN = 16;

function loadKey(): Buffer {
  const raw = process.env.GARMIN_TOKEN_KEY;
  if (!raw) {
    throw new Error(
      'GARMIN_TOKEN_KEY ausente — defina uma chave base64 de 32 bytes no ambiente do backend',
    );
  }
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error('GARMIN_TOKEN_KEY deve decodificar para exatamente 32 bytes (AES-256)');
  }
  return key;
}

export function encryptSecret(plaintext: string): string {
  const key = loadKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([Buffer.from([VERSION]), iv, tag, ct]).toString('base64');
}

export function decryptSecret(encoded: string): string {
  const key = loadKey();
  const buf = Buffer.from(encoded, 'base64');
  if (buf.length < 1 + IV_LEN + TAG_LEN) {
    throw new Error('ciphertext Garmin inválido');
  }
  if (buf[0] !== VERSION) {
    throw new Error(`versão de chave Garmin desconhecida: ${buf[0]}`);
  }
  const iv = buf.subarray(1, 1 + IV_LEN);
  const tag = buf.subarray(1 + IV_LEN, 1 + IV_LEN + TAG_LEN);
  const ct = buf.subarray(1 + IV_LEN + TAG_LEN);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}
