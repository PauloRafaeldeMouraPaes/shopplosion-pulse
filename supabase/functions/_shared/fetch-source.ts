export type SourceFetcher = (url: string) => Promise<Response>;
export type Wait = (milliseconds: number) => Promise<void>;

const defaultWait: Wait = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

/**
 * Retry transient HTTP/network failures, but never retry a 403. A forbidden
 * source is an access boundary, not a transient error or a reason to probe again.
 */
export async function fetchSourceWithRetry(
  url: string,
  fetcher: SourceFetcher,
  wait: Wait = defaultWait,
): Promise<Response> {
  let response: Response | null = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      response = await fetcher(url);
      if (response.ok || response.status === 403) break;
    } catch {
      response = null;
    }

    if (attempt < 2) await wait(500 * (attempt + 1));
  }

  if (!response?.ok) {
    throw new Error(`http_${response?.status || 0}`);
  }

  return response;
}
