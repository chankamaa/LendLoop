/**
 * Web Crypto HMAC-SHA256 signing and constant-time verification helpers.
 * Runs natively in Convex's V8 runtime with zero Node cold starts.
 */

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Constant-time string comparison to prevent timing side-channel attacks.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const bufA = encoder.encode(a);
  const bufB = encoder.encode(b);

  if (bufA.length !== bufB.length) {
    return false;
  }

  let diff = 0;
  for (let i = 0; i < bufA.length; i++) {
    diff |= bufA[i] ^ bufB[i];
  }
  return diff === 0;
}

/**
 * Computes `sha256=<hex>` HMAC-SHA256 signature for a raw payload string.
 */
export async function signHmacSha256(
  payload: string,
  secret: string
): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(payload)
  );
  return `sha256=${toHex(signature)}`;
}

/**
 * Verifies an incoming `X-Hub-Signature-256` header (`sha256=<hex>`)
 * against the raw request body using constant-time comparison.
 */
export async function verifyHmacSha256(
  rawBody: string,
  signatureHeader: string | null,
  secret: string
): Promise<boolean> {
  if (!signatureHeader || !secret) {
    return false;
  }
  const expected = await signHmacSha256(rawBody, secret);
  return constantTimeEqual(signatureHeader.trim(), expected);
}

/**
 * Verifies `Authorization: Bearer <secret>` in constant time.
 */
export function verifyBearerSecret(
  authHeader: string | null,
  secret: string
): boolean {
  if (!authHeader || !secret) {
    return false;
  }
  const prefix = "Bearer ";
  if (!authHeader.startsWith(prefix)) {
    return false;
  }
  const token = authHeader.slice(prefix.length).trim();
  return constantTimeEqual(token, secret);
}
