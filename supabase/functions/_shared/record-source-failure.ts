export type FailureWriteResult = { data?: unknown; error?: { message?: string } | null };
export type FailureWriter = () => Promise<FailureWriteResult>;
export type FailureReporter = (message: string) => void;

const defaultReporter: FailureReporter = (message) => console.error(message);

/**
 * Best-effort failure bookkeeping. A bookkeeping failure must not hide the
 * original collection error or prevent the worker from handling other sources.
 * Every failed status write is emitted as a structured, redacted event.
 */
export async function recordSourceFailure(
  sourceId: string,
  runId: string | null,
  originalError: string,
  updateSource: FailureWriter,
  updateRun: FailureWriter,
  report: FailureReporter = defaultReporter,
): Promise<{ sourceStatusPersisted: boolean; runStatusPersisted: boolean }> {
  let sourceStatusPersisted = false;
  let runStatusPersisted = runId === null;

  try {
    const result = await updateSource();
    if (result?.error) throw new Error(result.error.message || "unknown database error");
    sourceStatusPersisted = true;
  } catch (error) {
    report(JSON.stringify({
      event: "source_failure_status_persist_failed",
      target: "source",
      source_id: sourceId,
      error: String(error).slice(0, 300),
      original_error: originalError.slice(0, 300),
    }));
  }

  if (runId) {
    try {
      const result = await updateRun();
      if (result?.error) throw new Error(result.error.message || "unknown database error");
      runStatusPersisted = true;
    } catch (error) {
      report(JSON.stringify({
        event: "source_failure_status_persist_failed",
        target: "fetch_run",
        source_id: sourceId,
        fetch_run_id: runId,
        error: String(error).slice(0, 300),
        original_error: originalError.slice(0, 300),
      }));
    }
  }

  return { sourceStatusPersisted, runStatusPersisted };
}
