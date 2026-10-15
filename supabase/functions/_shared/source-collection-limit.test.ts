import { sourceCollectionLimitError, SOURCE_ITEM_LIMIT } from "./source-collection-limit.ts";

Deno.test("RSS collection above parser cap is explicitly incomplete", () => {
  const body = Array.from({ length: SOURCE_ITEM_LIMIT + 1 }, (_, i) =>
    `<item><title>Item ${i}</title></item>`).join("");
  const result = sourceCollectionLimitError("rss", `<rss><channel>${body}</channel></rss>`);
  if (result !== "source_snapshot_incomplete:collection_limit_exceeded") {
    throw new Error(`Expected explicit RSS truncation error, got ${String(result)}`);
  }
});

Deno.test("Atom collection above parser cap is explicitly incomplete", () => {
  const body = Array.from({ length: SOURCE_ITEM_LIMIT + 1 }, (_, i) =>
    `<entry><title>Entry ${i}</title></entry>`).join("");
  const result = sourceCollectionLimitError("rss", `<feed>${body}</feed>`);
  if (result !== "source_snapshot_incomplete:collection_limit_exceeded") {
    throw new Error(`Expected explicit Atom truncation error, got ${String(result)}`);
  }
});

Deno.test("JSON collection above parser cap is explicitly incomplete for supported shapes", () => {
  const items = Array.from({ length: SOURCE_ITEM_LIMIT + 1 }, (_, i) => ({ id: i }));
  for (const body of [JSON.stringify(items), JSON.stringify({ items }), JSON.stringify({ data: items })]) {
    const result = sourceCollectionLimitError("json", body);
    if (result !== "source_snapshot_incomplete:collection_limit_exceeded") {
      throw new Error(`Expected explicit JSON truncation error, got ${String(result)}`);
    }
  }
});

Deno.test("collections at parser cap and individual HTML pages are not falsely labeled truncated", () => {
  const items = Array.from({ length: SOURCE_ITEM_LIMIT }, (_, i) => ({ id: i }));
  if (sourceCollectionLimitError("json", JSON.stringify({ items })) !== null) {
    throw new Error("Exactly 50 JSON items should not be labeled truncated");
  }
  if (sourceCollectionLimitError("html", "<html><main>Article</main></html>") !== null) {
    throw new Error("HTML article should not be labeled as a collection");
  }
});

Deno.test("invalid JSON is left for the existing parser to reject", () => {
  if (sourceCollectionLimitError("json", "{not-json") !== null) {
    throw new Error("Truncation guard must not replace the existing JSON parse error");
  }
});
