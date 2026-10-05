/**
 * Current time in ms for expiry logic. When TEST_MODE=1, the
 * x-test-now-ms header (if valid) overrides the system clock.
 */
export function getNowMs(headers: Headers): number {
  if (process.env.TEST_MODE?.trim() === "1") {
    const raw = headers.get("x-test-now-ms");
    if (raw !== null && /^\d+$/.test(raw.trim())) {
      return Number(raw.trim());
    }
  }
  return Date.now();
}
