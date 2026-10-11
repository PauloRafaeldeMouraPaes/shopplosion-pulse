export function stableSourceExternalId(item: Record<string, unknown>): string | null {
  for (const key of ["id", "guid", "url", "link"] as const) {
    const value = item[key];
    if (value === null || value === undefined) continue;
    const candidate = String(value).trim();
    if (candidate.length > 0) return candidate;
  }
  return null;
}
