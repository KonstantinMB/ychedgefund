/**
 * Edge-compatible password hashing using Web Crypto API
 *
 * Uses PBKDF2 with SHA-256 — no bcrypt/argon2 (those require Node.js).
 * Works in Vercel Edge Runtime.
 */

const PBKDF2_ITERATIONS = 100_000;
const SALT_LENGTH = 16;
const HASH_LENGTH = 32;
const TOKEN_LENGTH = 32;

/**
 * Constant-time comparison to prevent timing attacks.
 * Edge Runtime may not have crypto.subtle.timingSafeEqual.
 */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a[i]! ^ b[i]!;
  return result === 0;
}

/**
 * Hash a password for storage.
 * Returns "salt:hash" as hex strings.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const hash = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    HASH_LENGTH * 8
  );

  const saltHex = Array.from(salt)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const hashHex = Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return `${saltHex}:${hashHex}`;
}

/**
 * Verify a password against stored "salt:hash".
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(':');
  if (parts.length !== 2) return false;

  const saltHex = parts[0]!;
  const storedHashHex = parts[1]!;

  if (saltHex.length !== SALT_LENGTH * 2 || storedHashHex.length !== HASH_LENGTH * 2) {
    return false;
  }

  const salt = new Uint8Array(SALT_LENGTH);
  for (let i = 0; i < SALT_LENGTH; i++) {
    salt[i] = parseInt(saltHex.slice(i * 2, i * 2 + 2), 16);
  }

  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const derivedHash = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    HASH_LENGTH * 8
  );

  const derivedArr = new Uint8Array(derivedHash);
  const storedHash = new Uint8Array(HASH_LENGTH);
  for (let i = 0; i < HASH_LENGTH; i++) {
    storedHash[i] = parseInt(storedHashHex.slice(i * 2, i * 2 + 2), 16);
  }

  return timingSafeEqual(derivedArr, storedHash);
}

/**
 * Generate a random session token (32 bytes → 64 hex chars).
 */
export function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(TOKEN_LENGTH));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
