import { sourceContentFingerprint } from "./source-content-fingerprint.ts";

Deno.test("fingerprint is deterministic and emits lowercase SHA-256", async () => {
  const first = await sourceContentFingerprint("Title", "https://example.test", "body");
  const second = await sourceContentFingerprint("Title", "https://example.test", "body");
  if (first !== second) throw new Error("Identical source content produced different fingerprints");
  if (!/^[0-9a-f]{64}$/.test(first)) throw new Error("Fingerprint is not lowercase SHA-256 hex");
  if (first !== "d7ad18a30127691a8d7589dd77fb832e6bf52834981dcea15845f175c87ad550") {
    throw new Error(`Canonical tuple/hash changed unexpectedly: ${first}`);
  }
});

Deno.test("null URL normalizes to empty string and payload changes alter the fingerprint", async () => {
  const nullUrl = await sourceContentFingerprint("Title", null, "body");
  const emptyUrl = await sourceContentFingerprint("Title", "", "body");
  if (nullUrl !== emptyUrl) throw new Error("Null URL normalization is not stable");

  const changedTitle = await sourceContentFingerprint("Other title", "", "body");
  const changedContent = await sourceContentFingerprint("Title", "", "changed");
  if (changedTitle === nullUrl || changedContent === nullUrl) {
    throw new Error("Title/content change did not alter fingerprint");
  }
});
