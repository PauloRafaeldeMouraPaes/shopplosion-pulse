/**
 * Fail closed when a response is known to be truncated, paginated, or outside
 * the worker's supported collection shape.
 *
 * This is a defensive completeness preflight, not proof of a complete snapshot.
 */
export const SOURCE_ITEM_LIMIT = 50;

const INCOMPLETE = "source_snapshot_incomplete";

function countBlocks(body: string, tag: string): number {
  const pattern = "<" + tag + "\\b[^>]*>[\\s\\S]*?</" + tag + "\\s*>";
  const matches = body.match(new RegExp(pattern, "gi"));
  return matches?.length ?? 0;
}

function hasNextPageLink(body: string): boolean {
  return /<link\b(?=[^>]*\brel\s*=\s*["']?next\b)[^>]*>/i.test(body)
    || /["'](?:next|next_page|nextPage|nextCursor|next_cursor)["']\s*:\s*(?:"[^"]+"|\d+|true)/i.test(body)
    || /["'](?:has_more|hasMore|has_next|hasNext)["']\s*:\s*true/i.test(body);
}

export function sourceCollectionLimitError(sourceType: string, body: string): string | null {
  if (sourceType === "rss") {
    const isAtom = /<feed\b/i.test(body);
    if (isAtom) {
      // Structural sanity check only; this is not a full XML well-formedness proof.
      if (!/<feed\b[^>]*>/i.test(body) || !/<\/feed\s*>/i.test(body)) {
        return INCOMPLETE + ":unsupported_or_invalid_feed_document";
      }
    } else if (
      !/<rss\b[^>]*>/i.test(body)
      || !/<channel\b[^>]*>/i.test(body)
      || !/<\/channel\s*>/i.test(body)
      || !/<\/rss\s*>/i.test(body)
    ) {
      return INCOMPLETE + ":unsupported_or_invalid_feed_document";
    }
    if (hasNextPageLink(body)) return INCOMPLETE + ":pagination_not_exhausted";
    const count = isAtom ? countBlocks(body, "entry") : countBlocks(body, "item");
    return count > SOURCE_ITEM_LIMIT ? INCOMPLETE + ":collection_limit_exceeded" : null;
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
    if (!collectionKey) return INCOMPLETE + ":unsupported_json_collection_shape";
    if (hasNextPageLink(body)) return INCOMPLETE + ":pagination_not_exhausted";
    const items = collectionKey === "root"
      ? parsed as unknown[]
      : record![collectionKey] as unknown[];
    if (items.length > SOURCE_ITEM_LIMIT) return INCOMPLETE + ":collection_limit_exceeded";

    // APIs often expose the total result count separately from the current page.
    // If that count exceeds the returned array, the worker must not mark this
    // partial page as a completed collection.
    const total = [record?.total_count, record?.totalCount, record?.total, record?.count]
      .find((value) => typeof value === "number" && Number.isFinite(value));
    if (typeof total === "number" && total > items.length) {
      return INCOMPLETE + ":reported_total_exceeds_returned_items";
    }
    return null;
  }

  // HTML is currently modeled as one page/article. This guard does not prove
  // that a listing/catalog has no additional pages.
  return null;
}

export const SOURCE_ITEM_FIELD_LIMITS = {
  externalId: 1000,
  title: 500,
  url: 2000,
  content: 12000,
} as const;

export type SourceItemFields = {
  externalId: string;
  title: string;
  url: string | null;
  content: string;
};

/**
 * Field limits protect storage and prevent distinct IDs or evidence bodies from
 * being silently collapsed by String.slice(). Over-limit items invalidate the
 * whole snapshot instead of being presented as faithfully captured evidence.
 */
export function sourceItemFieldLimitError(item: SourceItemFields): string | null {
  if (!item.externalId.length) return "source_snapshot_incomplete:source_item_identity_missing";
  if (item.externalId.length > SOURCE_ITEM_FIELD_LIMITS.externalId) {
    return "source_snapshot_incomplete:source_item_external_id_exceeds_limit";
  }
  if (item.title.length > SOURCE_ITEM_FIELD_LIMITS.title) {
    return "source_snapshot_incomplete:source_item_title_exceeds_limit";
  }
  if ((item.url?.length ?? 0) > SOURCE_ITEM_FIELD_LIMITS.url) {
    return "source_snapshot_incomplete:source_item_url_exceeds_limit";
  }
  if (item.content.length > SOURCE_ITEM_FIELD_LIMITS.content) {
    return "source_snapshot_incomplete:source_item_content_exceeds_limit";
  }
  return null;
}
