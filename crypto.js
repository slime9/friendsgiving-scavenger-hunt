// Shared by the browser (app.js) and the build script (Node 22 has the same Web Crypto API).
// Each locked page is AES-GCM encrypted with a key derived from the code shown on the
// previous clue, so the clue text simply does not exist on the page until the code is typed.

export const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I/L
export const CODE_LENGTH = 5;
const ITERATIONS = 150000;

const enc = new TextEncoder();
const dec = new TextDecoder();

export function normalizeCode(s) {
  return String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

const toB64 = (u8) => btoa(String.fromCharCode(...u8));
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function deriveKey(code, salt) {
  const base = await crypto.subtle.importKey('raw', enc.encode(normalizeCode(code)), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function seal(payload, code) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(code, salt);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(payload))));
  return { salt: toB64(salt), iv: toB64(iv), ct: toB64(ct) };
}

// Returns the payload, or null when the code is wrong (GCM authentication fails).
export async function unseal(box, code) {
  try {
    const key = await deriveKey(code, fromB64(box.salt));
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(box.iv) }, key, fromB64(box.ct));
    return JSON.parse(dec.decode(pt));
  } catch {
    return null;
  }
}
