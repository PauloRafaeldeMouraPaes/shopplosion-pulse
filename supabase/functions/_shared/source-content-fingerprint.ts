/**
 * Canonical source-content fingerprint contract.
 * Preserve this tuple order and null-URL normalization for compatibility with
 * existing snapshots: SHA-256(JSON.stringify([title, url ?? "", content])).
 */
export async function sourceContentFingerprint(
  title: string,
  url: string | null,
  content: string,
): Promise<string> {
  const canonicalPayload = JSON.stringify([title, url ?? "", content]);
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonicalPayload),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
