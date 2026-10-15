import { recordSourceFailure } from "./record-source-failure.ts";

Deno.test("failure bookkeeping records source and run failure", async () => {
  const writes: string[] = [];
  const reports: string[] = [];
  const result = await recordSourceFailure(
    "source-test",
    "run-test",
    "HTTP 403",
    async () => { writes.push("source"); return { data: { id: "persisted" }, error: null }; },
    async () => { writes.push("run"); return { data: { id: "persisted" }, error: null }; },
    (message) => reports.push(message),
  );

  if (!result.sourceStatusPersisted || !result.runStatusPersisted) {
    throw new Error("Expected both failure records to persist");
  }
  if (writes.join(",") !== "source,run") throw new Error("Unexpected failure-write order");
  if (reports.length !== 0) throw new Error("Successful bookkeeping emitted failure reports");
});

Deno.test("failure bookkeeping errors are observable and do not escape", async () => {
  const reports: string[] = [];
  let runWriteAttempted = false;
  const result = await recordSourceFailure(
    "source-test",
    "run-test",
    "source_item_history_persist_failed",
    async () => { return { error: { message: "source write unavailable" } }; },
    async () => { runWriteAttempted = true; throw new Error("run write unavailable"); },
    (message) => reports.push(message),
  );

  if (result.sourceStatusPersisted || result.runStatusPersisted) {
    throw new Error("Failed writes must not be reported as persisted");
  }
  if (!runWriteAttempted) throw new Error("Run failure write was skipped after source write failure");
  if (reports.length !== 2) throw new Error(`Expected two structured reports, got ${reports.length}`);
  if (!reports.some((message) => message.includes('"target":"source"'))) {
    throw new Error("Source status write failure was not reported");
  }
  if (!reports.some((message) => message.includes('"target":"fetch_run"'))) {
    throw new Error("Fetch-run status write failure was not reported");
  }
});

Deno.test("failure bookkeeping treats a zero-row update as not persisted", async () => {
  const reports: string[] = [];
  const result = await recordSourceFailure(
    "source-test",
    "run-test",
    "http_403",
    async () => ({ data: null, error: null }),
    async () => ({ data: { id: "run-test" }, error: null }),
    (message) => reports.push(message),
  );
  if (result.sourceStatusPersisted || !result.runStatusPersisted) {
    throw new Error("A missing source row must not be reported as persisted");
  }
  if (!reports.some((message) => message.includes("no_row"))) {
    throw new Error("A zero-row source update must emit a reconciliation warning");
  }
});
