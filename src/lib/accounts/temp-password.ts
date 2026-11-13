// DESIGN-4 6.2: the temporary password a teacher or admin hands to a student after a reset. 10 characters from an
// alphabet without look-alikes (no I, L, O, i, l, o, 0, 1), drawn with rejection sampling so every character is equally
// likely, and with at least one letter and one digit. The value is never stored, logged or put in a URL.

export const TEMP_PASSWORD_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
export const TEMP_PASSWORD_LENGTH = 10;

/** Bytes at or above this are rejected: 256 is not a multiple of the alphabet size (modulo bias). */
const BYTE_LIMIT = Math.floor(256 / TEMP_PASSWORD_ALPHABET.length) * TEMP_PASSWORD_ALPHABET.length;
/** A safety stop for a broken byte source; a real CSPRNG needs about 12 bytes per candidate. */
const MAX_BYTES = 4096;

export type RandomBytes = (n: number) => Uint8Array;

const cryptoBytes: RandomBytes = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n));

export function generateTempPassword(random: RandomBytes = cryptoBytes): string {
  let used = 0;
  for (;;) {
    let out = "";
    while (out.length < TEMP_PASSWORD_LENGTH) {
      const bytes = random(TEMP_PASSWORD_LENGTH - out.length);
      for (const b of bytes) {
        used += 1;
        if (b < BYTE_LIMIT && out.length < TEMP_PASSWORD_LENGTH) out += TEMP_PASSWORD_ALPHABET[b % TEMP_PASSWORD_ALPHABET.length];
      }
      if (used > MAX_BYTES) throw new Error("generateTempPassword: random source gave no usable bytes");
    }
    if (/[0-9]/.test(out) && /[A-Za-z]/.test(out)) return out;
  }
}
