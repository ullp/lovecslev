/** „Dnes“ v `Europe/Prague` jako `YYYY-MM-DD` (spec §0.6) — nezávislé na TZ serveru. */
export function todayInPrague(now: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Prague',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(now);
}
