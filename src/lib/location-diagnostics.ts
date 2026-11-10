/** Temporary opt-in diagnostics. Coordinates stay in this tab; nothing is uploaded. */
export function locationDiagnosticsEnabled(): boolean {
  try {
    return typeof window !== 'undefined' && sessionStorage.getItem('aslikaata.locationDiagnostics') === '1';
  } catch { return false; }
}

export function traceLocation(event: string, details: Record<string, unknown>) {
  if (!locationDiagnosticsEnabled()) return;
  const entry = { time: Math.round(performance.now()), event, ...details };
  const target = window as Window & { __ASLI_LOCATION_TRACE__?: Record<string, unknown>[] };
  const trace = target.__ASLI_LOCATION_TRACE__ ??= [];
  trace.push(entry);
  if (trace.length > 500) trace.shift();
  console.debug('[ASLI location]', entry);
}
