import { sourceCollectionLimitError, SOURCE_ITEM_LIMIT } from "./source-collection-limit.ts";

function assertIncomplete(result: string | null, reason: string): void {
  if (!result?.startsWith("source_snapshot_incomplete:")) {
    throw new Error("Expected incomplete snapshot for " + reason + ", got " + String(result));
  }
}

Deno.test("RSS collection above parser cap is explicitly incomplete", () => {
  const body = Array.from({ length: SOURCE_ITEM_LIMIT + 1 }, (_, i) =>
    "<item><title>Item " + i + "</title></item>").join("");
  assertIncomplete(sourceCollectionLimitError("rss", "<rss><channel>" + body + "</channel></rss>"), "RSS cap");
});

Deno.test("Atom collection above parser cap is explicitly incomplete", () => {
  const body = Array.from({ length: SOURCE_ITEM_LIMIT + 1 }, (_, i) =>
    "<entry><title>Entry " + i + "</title></entry>").join("");
  assertIncomplete(sourceCollectionLimitError("rss", "<feed>" + body + "</feed>"), "Atom cap");
});

Deno.test("JSON collection above parser cap is explicitly incomplete for supported shapes", () => {
  const items = Array.from({ length: SOURCE_ITEM_LIMIT + 1 }, (_, i) => ({ id: i }));
  for (const body of [JSON.stringify(items), JSON.stringify({ items }), JSON.stringify({ data: items })]) {
    assertIncomplete(sourceCollectionLimitError("json", body), "JSON cap");
  }
});

Deno.test("pagination hints fail closed for Atom and supported JSON responses", () => {
  assertIncomplete(
    sourceCollectionLimitError("rss", '<feed><link rel="next" href="/page/2"/><entry><title>A</title></entry></feed>'),
    "Atom next link",
  );
  assertIncomplete(
    sourceCollectionLimitError("json", JSON.stringify({ items: [{ id: 1 }], next: "/page/2" })),
    "JSON next page",
  );
  assertIncomplete(
    sourceCollectionLimitError("json", JSON.stringify({ data: [{ id: 1 }], has_more: true })),
    "JSON has_more",
  );
});

Deno.test("unsupported collection shape and invalid feed root fail closed", () => {
  assertIncomplete(sourceCollectionLimitError("json", JSON.stringify({ results: [{ id: 1 }] })), "unsupported JSON shape");
  assertIncomplete(sourceCollectionLimitError("rss", "<html>login page</html>"), "non-feed response");
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
