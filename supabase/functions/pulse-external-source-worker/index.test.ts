import { createSourceWorkerHandler } from "./index.ts";
import { fetchSourceWithRetry } from "../_shared/fetch-source.ts";

type Scenario = "http_403" | "observation_rpc_failure" | "source_failure_write_zero_rows" | "run_failure_write_zero_rows";
type FakeState = {
  source: Record<string, unknown>;
  run: Record<string, unknown> | null;
  sourceUpdates: Record<string, unknown>[];
  runUpdates: Record<string, unknown>[];
  fetchAttempts: number;
  observationCalls: number;
};

function fakeAdmin(state: FakeState, scenario: Scenario) {
  return {
    rpc: async (name: string) => {
      if (name === "pulse_intelligence_worker_token") return { data: "cron-secret", error: null };
      if (name === "pulse_record_source_item_observation") {
        state.observationCalls++;
        if (scenario !== "http_403") {
          return { data: null, error: { message: "injected observation persistence failure" } };
        }
        throw new Error("Observation RPC should not run for a 403 response");
      }
      throw new Error(`Unexpected RPC: ${name}`);
    },
    from: (table: string) => {
      const query: any = {
        table, action: "select", payload: null,
        select() { return this; },
        eq() { return this; },
        order() { return this; },
        limit() { return this; },
        insert(payload: Record<string, unknown>) { this.action = "insert"; this.payload = payload; return this; },
        update(payload: Record<string, unknown>) { this.action = "update"; this.payload = payload; return this; },
        single() { return resolve(this, true); },
        maybeSingle() { return resolve(this, false); },
        then(onFulfilled: (value: unknown) => unknown, onRejected: (reason: unknown) => unknown) {
          return Promise.resolve(resolveAwait(this)).then(onFulfilled, onRejected);
        },
      };
      return query;
    },
  };

  function resolve(query: any, required: boolean) {
    return Promise.resolve(resolveAwait(query, required));
  }

  function resolveAwait(query: any, required = false) {
    if (query.table === "intelligence_sources" && query.action === "select") {
      return { data: [state.source], error: null };
    }
    if (query.table === "intelligence_source_fetch_runs" && query.action === "select") {
      return { data: null, error: null };
    }
    if (query.table === "intelligence_source_fetch_runs" && query.action === "insert") {
      state.run = { id: "fetch-run-test", ...query.payload };
      return { data: { id: "fetch-run-test" }, error: null };
    }
    if (query.table === "intelligence_sources" && query.action === "update") {
      state.sourceUpdates.push(query.payload);
      if (scenario === "source_failure_write_zero_rows" && query.payload.last_error) {
        return { data: null, error: null };
      }
      Object.assign(state.source, query.payload);
      return { data: { id: "source-test" }, error: null };
    }
    if (query.table === "intelligence_source_fetch_runs" && query.action === "update") {
      state.runUpdates.push(query.payload);
      if (scenario === "run_failure_write_zero_rows" && query.payload.status === "failed") {
        return { data: null, error: null };
      }
      if (state.run) Object.assign(state.run, query.payload);
      return { data: { id: "fetch-run-test" }, error: null };
    }
    if (required) throw new Error(`Unexpected required query: ${query.table} ${query.action}`);
    throw new Error(`Unexpected query: ${query.table} ${query.action}`);
  }
}

function makeState(): FakeState {
  return {
    source: {
      id: "source-test",
      industry_id: "industry-test",
      name: "Test Chocolate Source",
      source_type: "json",
      url: "https://example.test/feed.json",
      poll_interval_minutes: 0,
      last_fetched_at: null,
    },
    run: null,
    sourceUpdates: [],
    runUpdates: [],
    fetchAttempts: 0,
    observationCalls: 0,
  };
}

function makeHandler(state: FakeState, scenario: Scenario) {
  const admin = fakeAdmin(state, scenario);
  return createSourceWorkerHandler({
    env: (name) => ({
      SUPABASE_URL: "http://supabase.test",
      SUPABASE_SECRET_KEYS: JSON.stringify({ default: "test-key" }),
    } as Record<string, string>)[name],
    createAdmin: () => admin,
    sleep: async () => {},
    fetchSource: async (url, _fetcher, wait) => {
      if (scenario === "http_403") {
        return await fetchSourceWithRetry(url, async () => {
          state.fetchAttempts++;
          return new Response("forbidden", { status: 403 });
        }, wait);
      }
      state.fetchAttempts++;
      return new Response(JSON.stringify({
        items: [{
          id: "item-1",
          title: "Chocolate category demand update",
          description: "A sufficiently long description of an observed public market change for the integration test.",
          url: "https://example.test/item-1",
        }],
      }), { status: 200, headers: { "content-type": "application/json" } });
    },
    logInfo: () => {},
    logError: () => {},
  });
}

async function invoke(handler: (request: Request) => Promise<Response>) {
  return await handler(new Request("http://worker.test/", {
    method: "POST",
    headers: { "x-pulse-cron": "cron-secret" },
  }));
}

Deno.test("worker records HTTP 403 as a failed run and never retries or accepts a snapshot", async () => {
  const state = makeState();
  const response = await invoke(makeHandler(state, "http_403"));
  const body = await response.json();

  if (response.status !== 200) throw new Error(`Expected worker reconciliation response, got ${response.status}`);
  if (body.status !== "completed_with_source_failures") throw new Error(`Unexpected status: ${body.status}`);
  if (state.fetchAttempts !== 1) throw new Error(`HTTP 403 must not retry; attempts=${state.fetchAttempts}`);
  if (state.observationCalls !== 0) throw new Error("A 403 response must not be persisted as an observation");
  if (state.run?.status !== "failed") throw new Error("Fetch run was not reconciled to failed");
  if (state.run?.completeness_status !== "failed") throw new Error("Access denial must not look like a complete snapshot");
  if (state.run?.absence_inference_eligible !== false) throw new Error("Failed run must not allow absence inference");
  if (!String(state.source.last_error).includes("http_403")) throw new Error("Source failure was not persisted");
  if (state.sourceUpdates.length !== 1 || state.runUpdates.length !== 1) {
    throw new Error("Both source and fetch-run failure writes must be attempted exactly once");
  }
});

Deno.test("worker reconciles source and fetch run when observation RPC persistence fails", async () => {
  const state = makeState();
  const response = await invoke(makeHandler(state, "observation_rpc_failure"));
  const body = await response.json();

  if (response.status !== 200) throw new Error(`Expected worker reconciliation response, got ${response.status}`);
  if (body.status !== "completed_with_source_failures") throw new Error(`Unexpected status: ${body.status}`);
  if (state.observationCalls !== 1) throw new Error("Expected exactly one observation RPC attempt");
  if (state.run?.status !== "failed") throw new Error("Fetch run was not marked failed after persistence error");
  if (state.run?.completeness_status !== "failed") throw new Error("Persistence failure must invalidate completeness");
  if (state.run?.absence_inference_eligible !== false) throw new Error("Persistence failure must disable absence inference");
  if (!String(state.source.last_error).includes("source_item_history_persist_failed")) {
    throw new Error("Source failure reason did not preserve the observation persistence error");
  }
  if (!String(state.run?.error).includes("source_item_history_persist_failed")) {
    throw new Error("Fetch-run failure reason did not preserve the observation persistence error");
  }
  if (state.sourceUpdates.length !== 1 || state.runUpdates.length !== 1) {
    throw new Error("Both source and fetch-run failure writes must be attempted exactly once");
  }
});
Deno.test("worker reports incomplete reconciliation when source failure update affects zero rows", async () => {
  const state = makeState();
  const response = await invoke(makeHandler(state, "source_failure_write_zero_rows"));
  const body = await response.json();
  if (body.status !== "reconciliation_incomplete" || body.failure_bookkeeping_failed !== 1) {
    throw new Error("A zero-row source update must be visible as incomplete reconciliation");
  }
  if (state.source.last_error !== undefined) throw new Error("A zero-row update must not be treated as persisted");
  if (state.run?.status !== "failed") throw new Error("The independent fetch-run failure update should still be attempted");
  if (state.sourceUpdates.length !== 1 || state.runUpdates.length !== 1) {
    throw new Error("Both failure writes must be attempted even when one affects zero rows");
  }
});

Deno.test("worker reports incomplete reconciliation when fetch-run failure update affects zero rows", async () => {
  const state = makeState();
  const response = await invoke(makeHandler(state, "run_failure_write_zero_rows"));
  const body = await response.json();
  if (body.status !== "reconciliation_incomplete" || body.failure_bookkeeping_failed !== 1) {
    throw new Error("A zero-row fetch-run update must be visible as incomplete reconciliation");
  }
  if (!String(state.source.last_error).includes("source_item_history_persist_failed")) {
    throw new Error("Source failure should persist independently when fetch-run update returns zero rows");
  }
  if (state.run?.status !== "running") throw new Error("Zero-row fetch-run update must not be treated as persisted");
  if (state.runUpdates.length !== 1) throw new Error("Fetch-run failure write was not attempted exactly once");
});
