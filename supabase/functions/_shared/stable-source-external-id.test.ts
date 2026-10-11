import { stableFeedExternalId, stableSourceExternalId } from "./stable-source-external-id.ts";

Deno.test("uses stable source identifiers before URL fallbacks", () => {
  const id = stableSourceExternalId({ id: "item-7", guid: "guid-7", url: "https://example.test/7" });
  if (id !== "item-7") throw new Error(`Expected id precedence, received ${id}`);
  const guid = stableSourceExternalId({ id: "", guid: "guid-8", link: "https://example.test/8" });
  if (guid !== "guid-8") throw new Error(`Expected guid fallback, received ${guid}`);
  const link = stableSourceExternalId({ title: "No id", link: "https://example.test/9" });
  if (link !== "https://example.test/9") throw new Error(`Expected link fallback, received ${link}`);
});

Deno.test("rejects records without stable identity and trims whitespace", () => {
  if (stableSourceExternalId({ title: "No identity", index: 3 }) !== null) {
    throw new Error("Records without a stable identifier must be rejected");
  }
  if (stableSourceExternalId({ id: "   ", guid: null }) !== null) {
    throw new Error("Whitespace-only identity must be rejected");
  }
  if (stableSourceExternalId({ id: "  stable-id  " }) !== "stable-id") {
    throw new Error("Stable identifiers must be normalized");
  }
});

Deno.test("reordering JSON items does not change their identity", () => {
  const a = { id: "A", title: "first" };
  const b = { id: "B", title: "second" };
  const before = [a, b].map(stableSourceExternalId);
  const after = [b, a].map(stableSourceExternalId);
  if (before[0] !== after[1] || before[1] !== after[0]) {
    throw new Error("Reordering must not change item identity");
  }
});

Deno.test("RSS and Atom entries require publisher ID or stable link", () => {
  if (stableFeedExternalId(" feed-guid ", "https://example.test/feed/1") !== "feed-guid") {
    throw new Error("Feed ID must take precedence over link");
  }
  if (stableFeedExternalId("", "https://example.test/feed/2") !== "https://example.test/feed/2") {
    throw new Error("Stable link must be used when feed ID is absent");
  }
  if (stableFeedExternalId("", "  ") !== null) {
    throw new Error("Feed entries without publisher ID or link must be rejected");
  }
});
