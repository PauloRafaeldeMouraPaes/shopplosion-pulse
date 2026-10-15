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
  const first = await assessSnapshotCompleteness({ ...input, runId: "run-1", previousRunId: "run-0" });
  const second = await assessSnapshotCompleteness({ ...input, runId: "run-2", previousRunId: "run-1" });
  if (!mayInferAbsence(first, second)) throw new Error("matching complete runs should permit absence evaluation");
  const changedScope = await assessSnapshotCompleteness({ ...input, url: "https://example.test/other", runId: "run-3", previousRunId: "run-2" });
  if (mayInferAbsence(first, changedScope)) throw new Error("scope change must reset consecutive-run rule");
  const incomplete = await assessSnapshotCompleteness({ ...input, paginationExhausted: false, runId: "run-3", previousRunId: "run-2" });
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

Deno.test("failure classification distinguishes access, rate limit, parsing, incompleteness, and persistence", async () => {
  const { classifySourceFailure } = await import("./source-completeness.ts");
  const cases: Array<[string, string]> = [
    ["http_403", "authentication_or_access_denied"],
    ["http_429", "rate_limited"],
    ["source_snapshot_incomplete:pagination_not_exhausted", "known_incomplete_response"],
    ["JSON parse failed", "parser_or_document_failure"],
    ["source_item_history_persist_failed", "persistence_failure"],
    ["fetch_run_predecessor_query_failed", "persistence_failure"],
  ];
  for (const [message, expected] of cases) {
    if (classifySourceFailure(message) !== expected) {
      throw new Error(`failure classification mismatch for ${message}`);
    }
  }
});

Deno.test("a failed or skipped run breaks the adjacent-run absence rule", async () => {
  const base = {
    sourceId: "source-1", sourceType: "json", url: "https://example.test/catalog",
    responseValidated: true, parserValidated: true, persistenceSucceeded: true,
    paginationExhausted: true, finiteScopeProven: true,
  };
  const previous = await assessSnapshotCompleteness({ ...base, runId: "run-10", previousRunId: "run-9" });
  const nonAdjacent = await assessSnapshotCompleteness({ ...base, runId: "run-12", previousRunId: "run-11" });
  if (mayInferAbsence(previous, nonAdjacent)) {
    throw new Error("a non-adjacent complete run must not authorize absence inference");
  }
});
