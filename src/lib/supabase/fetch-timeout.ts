/**
 * A fetch for supabase-js (`global.fetch`) that gives up after `ms` (M1): a hanging Supabase must not stall
 * `next build` (the cached public pages prerender through the anon client) or a request forever. An abort
 * signal passed by the caller still works (both are combined).
 */
export function fetchWithTimeout(ms: number, baseFetch: typeof fetch = (...args) => fetch(...args)): typeof fetch {
  return (input, init) => {
    const timeout = AbortSignal.timeout(ms);
    const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
    return baseFetch(input, { ...init, signal });
  };
}

/** Anonymous public reads (home totals, articles): short and read-only. */
export const ANON_FETCH_TIMEOUT_MS = 5_000;

/**
 * Session (server) and service (admin) clients: they also run RPC writes (checkout, approve) and Storage batch
 * removes (cron, 100 paths per call), so a longer budget. No long transfers go through them: uploads go
 * straight from the browser, and PDF generation is CPU work after the data has been read.
 */
export const SERVER_FETCH_TIMEOUT_MS = 10_000;
