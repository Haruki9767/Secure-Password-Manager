/**
 * Convert an ArrayBuffer / Uint8Array → base64 string.
 * Uses a chunked approach to avoid a stack overflow when spreading
 * large typed arrays into String.fromCharCode().
 */
export function toB64(arr) {
  const bytes = arr instanceof Uint8Array ? arr : new Uint8Array(arr)
  let bin = ''
  const CHUNK = 8192
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(bin)
}

export const fromB64 = str => Uint8Array.from(atob(str), c => c.charCodeAt(0))

/**
 * Derive an AES-256-GCM key from a password via PBKDF2.
 * 600,000 iterations — exceeds NIST SP 800-132 recommendation.
 */
export async function deriveKey(password, salt) {
  const enc         = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password),
    { name: 'PBKDF2' }, false, ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    {
      name:       'PBKDF2',
      salt:       salt instanceof Uint8Array ? salt : fromB64(salt),
      iterations: 600000,
      hash:       'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

/**
 * Encrypt any value → base64 ciphertext (IV prepended).
 * A fresh random 96-bit IV is generated for every encryption.
 */
export async function encrypt(encryptionKey, data) {
  if (!encryptionKey) throw new Error('No encryption key')
  const enc       = new TextEncoder()
  const iv        = crypto.getRandomValues(new Uint8Array(12))
  const plaintext = typeof data === 'string' ? data : JSON.stringify(data)
  const cipher    = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, encryptionKey, enc.encode(plaintext)
  )
  const combined = new Uint8Array(12 + cipher.byteLength)
  combined.set(iv, 0)
  combined.set(new Uint8Array(cipher), 12)
  return toB64(combined)
}

/**
 * Encrypt a raw ArrayBuffer directly → base64 ciphertext (IV prepended).
 * Avoids the double-base64 overhead that encrypt() would introduce for
 * binary data (raw bytes → encrypt directly, no intermediate base64).
 */
export async function encryptBinary(encryptionKey, arrayBuffer) {
  if (!encryptionKey) throw new Error('No encryption key')
  const iv     = crypto.getRandomValues(new Uint8Array(12))
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, encryptionKey, arrayBuffer
  )
  const combined = new Uint8Array(12 + cipher.byteLength)
  combined.set(iv, 0)
  combined.set(new Uint8Array(cipher), 12)
  return toB64(combined)
}

/**
 * Decrypt base64 ciphertext produced by encryptBinary → ArrayBuffer.
 */
export async function decryptBinary(encryptionKey, cipherB64) {
  if (!encryptionKey) throw new Error('No encryption key')
  const combined = fromB64(cipherB64)
  const iv       = combined.slice(0, 12)
  const cipher   = combined.slice(12)
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv }, encryptionKey, cipher)
}

/**
 * Decrypt base64 ciphertext → original value.
 * AES-GCM authentication tag ensures integrity.
 */
export async function decrypt(encryptionKey, cipherB64) {
  if (!encryptionKey) throw new Error('No encryption key')
  const combined = fromB64(cipherB64)
  const iv       = combined.slice(0, 12)
  const cipher   = combined.slice(12)
  const plain    = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv }, encryptionKey, cipher
  )
  const text = new TextDecoder().decode(plain)
  try { return JSON.parse(text) } catch { return text }
}

/** Cryptographically secure UUID */
export function uid() {
  if (crypto.randomUUID) return crypto.randomUUID()
  const a = crypto.getRandomValues(new Uint8Array(16))
  a[6] = (a[6] & 0x0f) | 0x40
  a[8] = (a[8] & 0x3f) | 0x80
  return [...a].map((b, i) => ([4, 6, 8, 10].includes(i) ? '-' : '') + b.toString(16).padStart(2, '0')).join('')
}

/**
 * Generate a cryptographically secure random password.
 * Uses crypto.getRandomValues — never Math.random.
 */
export function genPassword(len = 20, up = true, lo = true, num = true, sym = true) {
  const sets = []
  if (up)  sets.push('ABCDEFGHJKLMNPQRSTUVWXYZ')
  if (lo)  sets.push('abcdefghjkmnpqrstuvwxyz')
  if (num) sets.push('2345678923456789')
  if (sym) sets.push('!@#$%^&*()_+-=[]{}|;:,.?')
  if (!sets.length) sets.push('abcdefghijklmnopqrstuvwxyz')
  const pool = sets.join('')
  const rnd  = new Uint32Array(len + sets.length)
  crypto.getRandomValues(rnd)
  let pw = sets.map((s, i) => s[rnd[len + i] % s.length]).join('')
  for (let i = pw.length; i < len; i++) pw += pool[rnd[i] % pool.length]
  const arr  = pw.split('')
  const shuf = new Uint32Array(arr.length)
  crypto.getRandomValues(shuf)
  for (let i = arr.length - 1; i > 0; i--) {
    const j = shuf[i] % (i + 1)
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr.join('')
}

/** Score password strength (1–4) */
export function pwStrength(pw) {
  if (!pw) return { score: 0, label: '—' }
  let s = 0
  if (pw.length >= 8)  s++
  if (pw.length >= 14) s++
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++
  if (/[0-9]/.test(pw)) s++
  if (/[^A-Za-z0-9]/.test(pw)) s++
  const sc = Math.min(Math.max(Math.round(s * 4 / 5), 1), 4)
  return { score: sc, label: ['', 'Weak', 'Fair', 'Good', 'Strong'][sc] }
}
