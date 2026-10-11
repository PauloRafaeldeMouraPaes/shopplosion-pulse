export function stableSourceExternalId(item: Record<string, unknown>): string | null {
  for (const key of ["id", "guid", "url", "link"] as const) {
    const value = item[key];
    if (value === null || value === undefined) continue;
    const candidate = String(value).trim();
    if (candidate.length > 0) return candidate;
  }
  return null;
}

/** Feed entries must have a publisher-provided ID/GUID or a stable link. */
export function stableFeedExternalId(id: unknown, link: unknown): string | null {
  for (const value of [id, link]) {
    if (value === null || value === undefined) continue;
    const candidate = String(value).trim();
    if (candidate.length > 0) return candidate;
  }
  return null;
}
