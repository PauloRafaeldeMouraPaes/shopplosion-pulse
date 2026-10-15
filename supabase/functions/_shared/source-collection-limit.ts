/**
 * Fail closed when a response is known to be truncated, paginated, or outside
 * the worker's supported collection shape.
 *
 * This is a defensive completeness preflight, not proof of a complete snapshot.
 */
export const SOURCE_ITEM_LIMIT = 50;

const INCOMPLETE = "source_snapshot_incomplete";

function countBlocks(body: string, tag: string): number {
  const matches = body.match(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}\\s*>`, "gi"));
  return matches?.length ?? 0;
}

function hasNextPageLink(body: string): boolean {
  return /<link\\b(?=[^>]*\\brel\\s*=\\s*["']?next\\b)[^>]*>/i.test(body)
    || /["'](?:next|next_page|nextPage|nextCursor|next_cursor)["']\\s*:\\s*(?:"[^"]+"|\\d+|true)/i.test(body)
    || /["'](?:has_more|hasMore|has_next|hasNext)["']\\s*:\\s*true/i.test(body);
}

export function sourceCollectionLimitError(sourceType: string, body: string): string | null {
  if (sourceType === "rss") {
    if (!/<(?:rss|feed)\\b/i.test(body)) return `${INCOMPLETE}:unsupported_or_invalid_feed_document`;
    if (hasNextPageLink(body)) return `${INCOMPLETE}:pagination_not_exhausted`;
    const count = /<feed\\b/i.test(body)
      ? countBlocks(body, "entry")
      : countBlocks(body, "item");
    return count > SOURCE_ITEM_LIMIT ? `${INCOMPLETE}:collection_limit_exceeded` : null;
  }

  if (sourceType === "json") {
    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      return null; // The existing JSON parser will report invalid JSON.
    }
    const record = parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
    const collectionKey = Array.isArray(parsed)
      ? "root"
      : Array.isArray(record?.items)
      ? "items"
      : Array.isArray(record?.data)
      ? "data"
      : null;
    if (!collectionKey) return `${INCOMPLETE}:unsupported_json_collection_shape`;
    if (hasNextPageLink(body)) return `${INCOMPLETE}:pagination_not_exhausted`;
    const items = collectionKey === "root"
      ? parsed as unknown[]
      : record![collectionKey] as unknown[];
    return items.length > SOURCE_ITEM_LIMIT ? `${INCOMPLETE}:collection_limit_exceeded` : null;
  }

  // HTML is currently modeled as one page/article. This guard does not prove
  // that a listing/catalog has no additional pages.
  return null;
}
