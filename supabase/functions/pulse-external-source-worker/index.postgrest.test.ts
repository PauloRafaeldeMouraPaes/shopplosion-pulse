import { createClient } from "npm:@supabase/supabase-js@2";
import { createSourceWorkerHandler } from "./index.ts";

const SOURCE_ID = "22222222-2222-4222-8222-222222222222";
const INDUSTRY_ID = "11111111-1111-4111-8111-111111111111";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("worker calls the real PostgREST observation RPC and reconciles its atomic failure", async () => {
  const apiUrl = Deno.env.get("API_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY") ?? "";
  assert(apiUrl && serviceRoleKey, "API_URL and SERVICE_ROLE_KEY are required from the local Supabase CLI");
  const endpoint = new URL(apiUrl);
  assert(endpoint.hostname === "127.0.0.1" && endpoint.port === "54321",
    "This integration test must only use the ephemeral local Supabase API");

  const admin = createClient(apiUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const errors: string[] = [];
  const handler = createSourceWorkerHandler({
    env: (name) => ({
      SUPABASE_URL: apiUrl,
      SUPABASE_SECRET_KEYS: JSON.stringify({ default: serviceRoleKey }),
    } as Record<string, string>)[name],
    // Keep collection deterministic and offline; the Supabase/PostgREST persistence path is real.
    fetchSource: async () => new Response(JSON.stringify({
      items: [{
        id: "postgrest-atomic-failure",
        title: "Chocolate category demand update",
        description: "A sufficiently long public market observation used to test atomic rollback through PostgREST.",
        url: "https://example.test/item-postgrest-atomic-failure",
      }],
    }), { status: 200, headers: { "content-type": "application/json" } }),
    sleep: async () => {},
    logInfo: () => {},
    logError: (message) => errors.push(String(message)),
  });

  const response = await handler(new Request("http://worker.test/", {
    method: "POST",
    headers: { "x-pulse-cron": "test-cron-token" },
  }));
  const body = await response.json();
  assert(response.status === 200, "Worker should reconcile the source failure instead of crashing");
  assert(body.status === "completed_with_source_failures", "Expected source failure status: " + JSON.stringify(body));
  assert(body.sources_failed === 1, "Expected exactly one failed source");
  assert(body.failure_bookkeeping_failed === 0, "Failure bookkeeping itself should persist: " + JSON.stringify(body));

  const { data: source, error: sourceError } = await admin
    .from("intelligence_sources")
    .select("id,last_error")
    .eq("id", SOURCE_ID)
    .eq("industry_id", INDUSTRY_ID)
    .single();
  assert(!sourceError && source, "Could not read reconciled source row: " + String(sourceError));
  assert(String(source.last_error).includes("source_item_history_persist_failed"),
    "Source row must preserve the real PostgREST RPC failure");

  const { data: runs, error: runError } = await admin
    .from("intelligence_source_fetch_runs")
    .select("id,status,completeness_status,absence_inference_eligible,error")
    .eq("source_id", SOURCE_ID)
    .eq("industry_id", INDUSTRY_ID);
  assert(!runError && runs?.length === 1, "Expected exactly one persisted fetch run: " + String(runError));
  assert(runs[0].status === "failed", "Fetch run must be marked failed after the RPC error");
  assert(runs[0].completeness_status === "failed", "RPC failure must invalidate snapshot completeness");
  assert(runs[0].absence_inference_eligible === false, "RPC failure must disable absence inference");
  assert(String(runs[0].error).includes("source_item_history_persist_failed"),
    "Fetch-run row must preserve the real PostgREST RPC failure");

  const [items, versions, observations] = await Promise.all([
    admin.from("intelligence_source_items").select("id", { count: "exact", head: true }).eq("source_id", SOURCE_ID),
    admin.from("intelligence_source_item_versions").select("id", { count: "exact", head: true }).eq("source_id", SOURCE_ID),
    admin.from("intelligence_source_item_observations").select("id", { count: "exact", head: true }).eq("source_id", SOURCE_ID),
  ]);
  assert(!items.error && items.count === 0, "Current item projection must roll back with the failed RPC");
  assert(!versions.error && versions.count === 0, "Immutable version insert must roll back with the failed RPC");
  assert(!observations.error && observations.count === 0, "No observation may survive the failed atomic RPC");
  assert(!errors.some((line) => line.includes("source_failure_status_persist_failed") || line.includes("source_failure_reconciliation_incomplete")),
    "Unexpected failure-bookkeeping write error was logged");
});
