/**
 * Fail closed when a source response is known to exceed the worker's parser cap.
 *
 * This does NOT prove a snapshot is complete. It only prevents the current
 * 50-entry RSS/Atom/JSON limit from silently discarding known records while
 * the fetch run is marked completed.
 */
export const SOURCE_ITEM_LIMIT = 50;

function countBlocks(body: string, tag: string): number {
  const matches = body.match(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}\\s*>`, "gi"));
  return matches?.length ?? 0;
}

export function sourceCollectionLimitError(sourceType: string, body: string): string | null {
  if (sourceType === "rss") {
    const count = /<feed\\b/i.test(body)
      ? countBlocks(body, "entry")
      : countBlocks(body, "item");
    return count > SOURCE_ITEM_LIMIT ? "source_snapshot_incomplete:collection_limit_exceeded" : null;
  }

  if (sourceType === "json") {
    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      return null; // The existing JSON parser will raise the parse error.
    }
    const record = parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
    const items = Array.isArray(parsed)
      ? parsed
      : Array.isArray(record?.items)
      ? record.items
      : Array.isArray(record?.data)
      ? record.data
      : [];
    return items.length > SOURCE_ITEM_LIMIT
      ? "source_snapshot_incomplete:collection_limit_exceeded"
      : null;
  }

  // HTML currently represents an individual page, not a paginated collection.
  // Do not pretend this check establishes page/catalog completeness.
  return null;
}
