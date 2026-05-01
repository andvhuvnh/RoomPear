import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

/** IANA zone for daily quotas (swipes, top picks, free reveal). Pacific observes DST (PDT/PST). */
export const ROOMPEAR_DAILY_TZ = 'America/Los_Angeles';

export function laCalendarDateString(when: Date = new Date()): string {
  return formatInTimeZone(when, ROOMPEAR_DAILY_TZ, 'yyyy-MM-dd');
}

/** Next Gregorian yyyy-MM-dd after `ymd` (civil date math; safe for quota boundaries). */
function incrementGregorianYmd(ymd: string): string {
  const [yStr, mStr, dStr] = ymd.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + 1);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

/**
 * [startIso, endIso) for the Los Angeles calendar day containing `when`.
 * Used with `swipes.created_at` (timestamptz) so counts align with Postgres.
 */
export function laCalendarDayBounds(when: Date = new Date()): { startIso: string; endIso: string } {
  const ymd = laCalendarDateString(when);
  const start = fromZonedTime(`${ymd} 00:00:00`, ROOMPEAR_DAILY_TZ);
  const nextYmd = incrementGregorianYmd(ymd);
  const end = fromZonedTime(`${nextYmd} 00:00:00`, ROOMPEAR_DAILY_TZ);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

/** True when both instants fall on the same America/Los_Angeles calendar date. */
export function isSameLaCalendarDay(a: Date | string, b: Date | string = new Date()): boolean {
  const da = typeof a === 'string' ? new Date(a) : a;
  const db = typeof b === 'string' ? new Date(b) : b;
  return laCalendarDateString(da) === laCalendarDateString(db);
}
