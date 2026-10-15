import {
  assessSnapshotCompleteness,
  mayInferAbsence,
  sourceScopeFingerprint,
} from "./source-completeness.ts";

Deno.test("scope fingerprint is stable and changes with source scope or parser version", async () => {
  const base = { sourceId: "source-1", sourceType: "json", url: "https://example.test/catalog" };
  const first = await sourceScopeFingerprint(base);
  if (first !== await sourceScopeFingerprint(base)) throw new Error("fingerprint is not stable");
  if (first === await sourceScopeFingerprint({ ...base, url: "https://example.test/other" })) {
    throw new Error("URL scope change did not change fingerprint");
  }
  if (first === await sourceScopeFingerprint({ ...base, parserVersion: "v2" })) {
    throw new Error("parser version change did not change fingerprint");
  }
  if (!/^[0-9a-f]{64}$/.test(first)) throw new Error("scope fingerprint is not SHA-256 hex");
});

Deno.test("empty but unproven source response is not eligible to infer absence", async () => {
  const result = await assessSnapshotCompleteness({
    sourceId: "source-1", sourceType: "json", url: "https://example.test/catalog",
    responseValidated: true, parserValidated: true, persistenceSucceeded: true,
    paginationExhausted: false, finiteScopeProven: false,
  });
  if (result.completenessStatus !== "incomplete" || result.absenceInferenceEligible) {
    throw new Error("unproven empty response must not establish absence");
  }
});

Deno.test("two complete runs must share the same scope before absence can be inferred", async () => {
  const input = {
    sourceId: "source-1", sourceType: "json", url: "https://example.test/catalog",
    responseValidated: true, parserValidated: true, persistenceSucceeded: true,
    paginationExhausted: true, finiteScopeProven: true,
  };
  const first = await assessSnapshotCompleteness(input);
  const second = await assessSnapshotCompleteness(input);
  if (!mayInferAbsence(first, second)) throw new Error("matching complete runs should permit absence evaluation");
  const changedScope = await assessSnapshotCompleteness({ ...input, url: "https://example.test/other" });
  if (mayInferAbsence(first, changedScope)) throw new Error("scope change must reset consecutive-run rule");
  const incomplete = await assessSnapshotCompleteness({ ...input, paginationExhausted: false });
  if (mayInferAbsence(first, incomplete)) throw new Error("incomplete run must never confirm absence");
});

Deno.test("parser or persistence failure disables absence inference", async () => {
  for (const override of [{ parserValidated: false }, { persistenceSucceeded: false }, { responseValidated: false }]) {
    const result = await assessSnapshotCompleteness({
      sourceId: "source-1", sourceType: "rss", url: "https://example.test/feed",
      responseValidated: true, parserValidated: true, persistenceSucceeded: true,
      paginationExhausted: true, finiteScopeProven: true, ...override,
    });
    if (result.completenessStatus !== "failed" || result.absenceInferenceEligible) {
      throw new Error("failed validation/persistence must disable absence inference");
    }
  }
});
