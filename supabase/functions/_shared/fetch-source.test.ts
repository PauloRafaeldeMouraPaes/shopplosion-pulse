import { fetchSourceWithRetry } from "./fetch-source.ts";

Deno.test("HTTP 403 is not retried and remains an explicit failure", async () => {
  let calls = 0;
  let waits = 0;

  try {
    await fetchSourceWithRetry(
      "https://source.example.test/blocked",
      async () => {
        calls++;
        return new Response("forbidden", { status: 403 });
      },
      async () => { waits++; },
    );
    throw new Error("Expected HTTP 403 to reject");
  } catch (error) {
    if (!(error instanceof Error) || error.message !== "http_403") throw error;
  }

  if (calls !== 1) throw new Error(`Expected one request after 403, got ${calls}`);
  if (waits !== 0) throw new Error(`Expected no retry wait after 403, got ${waits}`);
});

Deno.test("transient server errors can retry before success", async () => {
  let calls = 0;
  const waits: number[] = [];
  const response = await fetchSourceWithRetry(
    "https://source.example.test/transient",
    async () => {
      calls++;
      return calls === 1
        ? new Response("temporarily unavailable", { status: 503 })
        : new Response("ok", { status: 200 });
    },
    async (milliseconds) => { waits.push(milliseconds); },
  );

  if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
  if (calls !== 2) throw new Error(`Expected two requests, got ${calls}`);
  if (waits.length !== 1 || waits[0] !== 500) {
    throw new Error(`Unexpected retry schedule: ${waits.join(",")}`);
  }
});
