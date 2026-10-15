import { sourceCollectionLimitError, SOURCE_ITEM_LIMIT, sourceItemFieldLimitError, SOURCE_ITEM_FIELD_LIMITS } from "./source-collection-limit.ts";

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

Deno.test("JSON total metadata larger than the returned array fails closed", () => {
  assertIncomplete(
    sourceCollectionLimitError("json", JSON.stringify({ items: [{ id: 1 }], total_count: 120 })),
    "JSON total_count",
  );
  assertIncomplete(
    sourceCollectionLimitError("json", JSON.stringify({ data: [{ id: 1 }], totalCount: 2 })),
    "JSON totalCount",
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


Deno.test("RSS without a channel or closing structure fails closed instead of becoming an empty capture", () => {
  for (const body of [
    "<rss></rss>",
    "<rss><channel></channel>",
    "<rss><item><title>orphan</title></item></rss>",
  ]) {
    assertIncomplete(sourceCollectionLimitError("rss", body), "malformed RSS structure");
  }
});

Deno.test("Atom without a closing feed root fails closed", () => {
  assertIncomplete(
    sourceCollectionLimitError("rss", "<feed><entry><title>incomplete document</title></entry>"),
    "malformed Atom structure",
  );
});

Deno.test("item fields at documented storage limits are accepted without truncation", () => {
  const result = sourceItemFieldLimitError({
    externalId: "i".repeat(SOURCE_ITEM_FIELD_LIMITS.externalId),
    title: "t".repeat(SOURCE_ITEM_FIELD_LIMITS.title),
    url: "u".repeat(SOURCE_ITEM_FIELD_LIMITS.url),
    content: "c".repeat(SOURCE_ITEM_FIELD_LIMITS.content),
  });
  if (result !== null) throw new Error("Exact field limits must not be rejected: " + result);
});

Deno.test("over-limit identity, title, URL, or content invalidates the entire snapshot", () => {
  const base = { externalId: "stable-id", title: "Title", url: "https://example.test/item", content: "Content" };
  const cases: Array<[string, Partial<typeof base>, string]> = [
    ["identity", { externalId: "i".repeat(SOURCE_ITEM_FIELD_LIMITS.externalId + 1) }, "source_item_external_id_exceeds_limit"],
    ["title", { title: "t".repeat(SOURCE_ITEM_FIELD_LIMITS.title + 1) }, "source_item_title_exceeds_limit"],
    ["URL", { url: "u".repeat(SOURCE_ITEM_FIELD_LIMITS.url + 1) }, "source_item_url_exceeds_limit"],
    ["content", { content: "c".repeat(SOURCE_ITEM_FIELD_LIMITS.content + 1) }, "source_item_content_exceeds_limit"],
  ];
  for (const [field, override, reason] of cases) {
    const result = sourceItemFieldLimitError({ ...base, ...override });
    if (result !== "source_snapshot_incomplete:" + reason) {
      throw new Error(field + " over-limit handling was not fail-closed: " + String(result));
    }
  }
});

Deno.test("missing stable identity invalidates item rather than falling back to truncation", () => {
  const result = sourceItemFieldLimitError({
    externalId: "", title: "Title", url: null, content: "Content",
  });
  if (result !== "source_snapshot_incomplete:source_item_identity_missing") {
    throw new Error("Missing source identity was not rejected: " + String(result));
  }
});
