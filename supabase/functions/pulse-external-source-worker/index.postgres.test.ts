import postgres from "npm:postgres@3.4.7";
import { createSourceWorkerHandler } from "./index.ts";
import { fetchSourceWithRetry } from "../_shared/fetch-source.ts";

type Scenario = "http_403" | "observation_rpc_failure";

const identifier = (value: string) => {
  if (!/^[a-z_][a-z0-9_]*$/i.test(value)) throw new Error("Unsafe SQL identifier");
  return '"' + value + '"';
};

async function runPostgresScenario(scenario: Scenario) {
  const databaseUrl = Deno.env.get("DATABASE_URL");
  if (!databaseUrl) throw new Error("DATABASE_URL is required for the PostgreSQL-backed worker test");
  const db = postgres(databaseUrl, { max: 1, prepare: false });
  const schema = "source_worker_test_" + crypto.randomUUID().replaceAll("-", "");
  const q = (table: string) => `${identifier(schema)}.${identifier(table)}`;

  try {
    await db.unsafe(`create schema ${identifier(schema)}`);
    await db.unsafe(`create table ${q("intelligence_sources")} (
      id text primary key, industry_id text not null, name text not null,
      source_type text not null, url text not null, active boolean not null,
      poll_interval_minutes integer not null default 0, last_fetched_at timestamptz,
      last_success_at timestamptz, last_error text, updated_at timestamptz
    )`);
    await db.unsafe(`create table ${q("intelligence_source_fetch_runs")} (
      id text primary key default gen_random_uuid()::text, source_id text not null, industry_id text not null,
      started_at timestamptz not null default now(), finished_at timestamptz,
      status text not null, items_seen integer not null default 0,
      items_changed integer not null default 0, error text,
      previous_fetch_run_id text, scope_fingerprint text, parser_version text,
      completeness_status text not null, absence_inference_eligible boolean not null,
      completeness_reason text, pagination_exhausted boolean not null,
      finite_scope_proven boolean not null, response_status integer,
      response_content_type text, reported_total_count bigint,
      returned_item_count integer not null default 0
    )`);
    await db.unsafe(`insert into ${q("intelligence_sources")}
      (id, industry_id, name, source_type, url, active, poll_interval_minutes)
      values ($1,$2,$3,$4,$5,true,0)`,
      ["source-test", "industry-test", "Test Chocolate Source", "json", "https://example.test/feed.json"]);

    const allowedTables = new Set(["intelligence_sources", "intelligence_source_fetch_runs"]);
    const admin = {
      rpc: async (name: string) => {
        if (name === "pulse_intelligence_worker_token") return { data: "cron-secret", error: null };
        if (name === "pulse_record_source_item_observation" && scenario === "observation_rpc_failure") {
          return { data: null, error: { message: "injected observation persistence failure" } };
        }
        throw new Error("Unexpected RPC: " + name);
      },
      from: (table: string) => {
        if (!allowedTables.has(table)) throw new Error("Unexpected table: " + table);
        const query: any = {
          table, action: "select", payload: null, selected: "*", filters: [], orders: [], rowLimit: null,
          select(columns: string) { this.selected = columns || "*"; return this; },
          eq(column: string, value: unknown) { this.filters.push([column, value]); return this; },
          order(column: string, options?: { ascending?: boolean }) { this.orders.push([column, options?.ascending !== false]); return this; },
          limit(value: number) { this.rowLimit = value; return this; },
          insert(payload: Record<string, unknown>) { this.action = "insert"; this.payload = payload; return this; },
          update(payload: Record<string, unknown>) { this.action = "update"; this.payload = payload; return this; },
          single() { return this.execute(true); },
          maybeSingle() { return this.execute(false); },
          then(onFulfilled: (value: unknown) => unknown, onRejected: (reason: unknown) => unknown) {
            return this.execute(false).then(onFulfilled, onRejected);
          },
          async execute(single: boolean) {
            try {
              const tableSql = q(this.table);
              let statement = "";
              let values: unknown[] = [];
              if (this.action === "select") {
                values = this.filters.map((filter: [string, unknown]) => filter[1]);
                const where = this.filters.map((filter: [string, unknown], i: number) => `${identifier(filter[0])} = $${i + 1}`).join(" and ");
                const order = this.orders.map((entry: [string, boolean]) => `${identifier(entry[0])} ${entry[1] ? "asc" : "desc"}`).join(", ");
                statement = `select ${this.selected === "*" ? "*" : this.selected.split(",").map((name: string) => identifier(name.trim())).join(", ")} from ${tableSql}${where ? " where " + where : ""}${order ? " order by " + order : ""}${this.rowLimit ? " limit " + Number(this.rowLimit) : ""}`;
              } else if (this.action === "insert") {
                const columns = Object.keys(this.payload);
                values = columns.map((name) => this.payload[name]);
                statement = `insert into ${tableSql} (${columns.map(identifier).join(", ")}) values (${values.map((_, i) => "$" + (i + 1)).join(", ")}) returning ${this.selected.split(",").map((name: string) => identifier(name.trim())).join(", ")}`;
              } else {
                const columns = Object.keys(this.payload);
                values = columns.map((name) => this.payload[name]);
                const sets = columns.map((name, i) => `${identifier(name)} = $${i + 1}`).join(", ");
                const where = this.filters.map((filter: [string, unknown], i: number) => {
                  values.push(filter[1]);
                  return `${identifier(filter[0])} = $${columns.length + i + 1}`;
                }).join(" and ");
                statement = `update ${tableSql} set ${sets}${where ? " where " + where : ""} returning ${this.selected.split(",").map((name: string) => identifier(name.trim())).join(", ")}`;
              }
              const rows = await db.unsafe(statement, values as any[]);
              if (single) return { data: rows[0] ?? null, error: null };
              if (this.action === "select") return { data: rows, error: null };
              return { data: rows[0] ?? null, error: null };
            } catch (error) {
              return { data: null, error: { message: String(error) } };
            }
          },
        };
        return query;
      },
    };

    const handler = createSourceWorkerHandler({
      env: (name) => ({
        SUPABASE_URL: "http://supabase.test",
        SUPABASE_SECRET_KEYS: JSON.stringify({ default: "test-key" }),
      } as Record<string, string>)[name],
      createAdmin: () => admin,
      sleep: async () => {},
      fetchSource: async (url, _fetcher, wait) => {
        if (scenario === "http_403") {
          return await fetchSourceWithRetry(url, async () => new Response("forbidden", { status: 403 }), wait);
        }
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
    const response = await handler(new Request("http://worker.test/", {
      method: "POST",
      headers: { "x-pulse-cron": "cron-secret" },
    }));
    const body = await response.json();
    if (response.status !== 200 || body.status !== "completed_with_source_failures") {
      throw new Error("Unexpected worker response: " + JSON.stringify({ status: response.status, body }));
    }

    const sources = await db.unsafe(`select last_error from ${q("intelligence_sources")} where id = $1`, ["source-test"]);
    const runs = await db.unsafe(`select status, completeness_status, absence_inference_eligible, error, items_seen from ${q("intelligence_source_fetch_runs")}`);
    if (sources.length !== 1 || !String(sources[0].last_error).length) {
      throw new Error("PostgreSQL source failure state was not persisted");
    }
    if (runs.length !== 1 || runs[0].status !== "failed" || runs[0].absence_inference_eligible !== false) {
      throw new Error("PostgreSQL fetch-run failure state was not persisted safely");
    }
    if (runs[0].completeness_status !== "failed") throw new Error("Failed collection was not marked incomplete/failed");
    if (scenario === "http_403" && runs[0].items_seen !== 0) throw new Error("403 must not create observed items");
    if (scenario === "observation_rpc_failure" && !String(runs[0].error).includes("source_item_history_persist_failed")) {
      throw new Error("Fetch-run row did not preserve the observation persistence error");
    }
  } finally {
    try { await db.unsafe(`drop schema if exists ${identifier(schema)} cascade`); } catch { /* preserve the test failure */ }
    await db.end();
  }
}

Deno.test({
  name: "PostgreSQL-backed worker reconciles a forbidden source without accepting a snapshot",
  permissions: { env: ["DATABASE_URL"], net: ["localhost:5432"] },
  fn: async () => await runPostgresScenario("http_403"),
});

Deno.test({
  name: "PostgreSQL-backed worker reconciles observation RPC persistence failure",
  permissions: { env: ["DATABASE_URL"], net: ["localhost:5432"] },
  fn: async () => await runPostgresScenario("observation_rpc_failure"),
});
