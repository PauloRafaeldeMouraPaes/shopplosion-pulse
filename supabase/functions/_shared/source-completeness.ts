/**
 * Conservative snapshot metadata for the external-source worker.
 *
 * A successfully fetched page/feed is not automatically a complete catalogue.
 * Current worker adapters do not prove exhaustive traversal for any source type,
 * so absence inference stays disabled until an adapter can prove its scope.
 */
export const SOURCE_PARSER_VERSION = "external-source-worker-v1";

export type SnapshotCompleteness = {
  scopeFingerprint: string;
  parserVersion: string;
  completenessStatus: "complete" | "incomplete" | "failed";
  absenceInferenceEligible: boolean;
  completenessReason: string;
};

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Hashes canonical scope inputs; the raw URL is not returned or logged.
 * Callers must not interpret a stable fingerprint as proof of completeness.
 */
export async function sourceScopeFingerprint(input: {
  sourceId: string;
  sourceType: string;
  url: string;
  parserVersion?: string;
}): Promise<string> {
  const canonical = JSON.stringify({
    source_id: input.sourceId,
    source_type: input.sourceType.toLowerCase(),
    url: input.url,
    parser_version: input.parserVersion ?? SOURCE_PARSER_VERSION,
  });
  return sha256Hex(canonical);
}

/**
 * Until pagination exhaustion and finite source scope are proven by an adapter,
 * no currently supported source can establish absence. Even an empty response
 * therefore cannot authorize an absence conclusion.
 */
export async function assessSnapshotCompleteness(input: {
  sourceId: string;
  sourceType: string;
  url: string;
  responseValidated: boolean;
  parserValidated: boolean;
  persistenceSucceeded: boolean;
  paginationExhausted: boolean;
  finiteScopeProven: boolean;
}): Promise<SnapshotCompleteness> {
  const scopeFingerprint = await sourceScopeFingerprint(input);
  if (!input.responseValidated || !input.parserValidated || !input.persistenceSucceeded) {
    return {
      scopeFingerprint,
      parserVersion: SOURCE_PARSER_VERSION,
      completenessStatus: "failed",
      absenceInferenceEligible: false,
      completenessReason: !input.responseValidated ? "response_not_validated"
        : !input.parserValidated ? "parser_not_validated"
        : "persistence_not_confirmed",
    };
  }
  if (!input.paginationExhausted || !input.finiteScopeProven) {
    return {
      scopeFingerprint,
      parserVersion: SOURCE_PARSER_VERSION,
      completenessStatus: "incomplete",
      absenceInferenceEligible: false,
      completenessReason: !input.paginationExhausted ? "pagination_exhaustion_unproven"
        : "finite_scope_unproven",
    };
  }
  return {
    scopeFingerprint,
    parserVersion: SOURCE_PARSER_VERSION,
    completenessStatus: "complete",
    absenceInferenceEligible: true,
    completenessReason: "finite_scope_and_pagination_proven",
  };
}

/** Absence requires two adjacent successful runs for the exact same scope. */
export function mayInferAbsence(previous: SnapshotCompleteness | null, current: SnapshotCompleteness): boolean {
  return Boolean(
    previous
    && previous.completenessStatus === "complete"
    && current.completenessStatus === "complete"
    && previous.absenceInferenceEligible
    && current.absenceInferenceEligible
    && previous.scopeFingerprint === current.scopeFingerprint
  );
}
