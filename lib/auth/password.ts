const ALGORITHM = "PBKDF2";
const DIGEST = "SHA-256";
const ITERATIONS = 600_000;
const KEY_LENGTH_BITS = 256;
const SALT_BYTES = 16;
const SCHEME = "pbkdf2";

// Web Crypto exists in browsers and in Node 20+, so a hash created here stays
// verifiable after authentication moves to a server-side MongoDB implementation.
const getCrypto = (): Crypto => {
  const webCrypto = globalThis.crypto;
  if (!webCrypto?.subtle) {
    throw new Error("Web Crypto is unavailable. Use localhost or HTTPS to sign in.");
  }
  return webCrypto;
};

const toBase64 = (bytes: Uint8Array): string =>
  btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(""));

const fromBase64 = (value: string): Uint8Array<ArrayBuffer> =>
  Uint8Array.from(atob(value), (char) => char.charCodeAt(0));

const derive = async (
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
  lengthBits: number,
): Promise<Uint8Array<ArrayBuffer>> => {
  const webCrypto = getCrypto();
  const key = await webCrypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    ALGORITHM,
    false,
    ["deriveBits"],
  );
  const bits = await webCrypto.subtle.deriveBits(
    { name: ALGORITHM, salt, iterations, hash: DIGEST },
    key,
    lengthBits,
  );
  return new Uint8Array(bits);
};

const constantTimeEqual = (left: Uint8Array, right: Uint8Array): boolean => {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
};

/** Returns `pbkdf2$<iterations>$<salt>$<hash>`; Node's crypto can verify it as-is. */
export const hashPassword = async (password: string): Promise<string> => {
  const salt = getCrypto().getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await derive(password, salt, ITERATIONS, KEY_LENGTH_BITS);
  return [SCHEME, ITERATIONS, toBase64(salt), toBase64(hash)].join("$");
};

export const needsRehash = (storedHash: string): boolean => {
  const iterations = Number.parseInt(storedHash.split("$")[1] ?? "", 10);
  return !Number.isFinite(iterations) || iterations < ITERATIONS;
};

export const verifyPassword = async (password: string, storedHash: string): Promise<boolean> => {
  const [scheme, iterationsRaw, saltRaw, hashRaw] = storedHash.split("$");
  if (scheme !== SCHEME || !iterationsRaw || !saltRaw || !hashRaw) return false;

  const iterations = Number.parseInt(iterationsRaw, 10);
  if (!Number.isFinite(iterations) || iterations <= 0) return false;

  try {
    const expected = fromBase64(hashRaw);
    const actual = await derive(password, fromBase64(saltRaw), iterations, expected.byteLength * 8);
    return constantTimeEqual(actual, expected);
  } catch {
    // A malformed hash or missing Web Crypto must read as "wrong password", not a crash.
    return false;
  }
};
