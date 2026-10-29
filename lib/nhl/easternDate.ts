// NHL schedules are published in Eastern time, so "today"/"tomorrow" has to
// be computed against the Eastern calendar date, not whatever TZ the server
// happens to run in. Shared by every source that offers a "tomorrow" view
// (starting goalies, games) so they agree on what date that means.
export const NHL_TIME_ZONE = "America/New_York";

function easternDateString(date: Date): string {
  // en-CA formats as YYYY-MM-DD, which also matches the date-page URL format
  // both dailyfaceoff.com and the NHL API use (e.g. /starting-goalies/2026-10-22,
  // /v1/score/2026-10-22).
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: NHL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function getTodayEasternDate(): string {
  return easternDateString(new Date());
}

export function getTomorrowEasternDate(): string {
  const [y, m, d] = easternDateString(new Date()).split("-").map(Number);
  // Pure calendar arithmetic on the already-Eastern Y/M/D — Date.UTC
  // normalizes day overflow (e.g. day 32 rolls into the next month) without
  // needing a second timezone conversion.
  const tomorrow = new Date(Date.UTC(y, m - 1, d + 1));
  return [
    tomorrow.getUTCFullYear(),
    String(tomorrow.getUTCMonth() + 1).padStart(2, "0"),
    String(tomorrow.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

// Eastern's UTC offset (-5h EST / -4h EDT) for whatever date is passed in,
// read via Intl rather than hardcoded so it's correct across the DST
// transition without needing a timezone database dependency.
function getEasternOffsetMinutes(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: NHL_TIME_ZONE,
    timeZoneName: "shortOffset",
  }).formatToParts(date);
  const offsetName =
    parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT-5";
  const match = /GMT([+-]\d+)/.exec(offsetName);
  return (match ? Number(match[1]) : -5) * 60;
}

// The next upcoming midnight in Eastern time, as an absolute instant.
export function getNextEasternMidnight(from: Date = new Date()): Date {
  const [y, m, d] = easternDateString(from).split("-").map(Number);
  // Start from "midnight UTC on tomorrow's Eastern date" as a guess, then
  // shift by Eastern's actual offset on that date to land on the real
  // instant. If `from` happens to already be exactly midnight Eastern, this
  // still correctly returns tomorrow's midnight rather than right now.
  const guessUTC = new Date(Date.UTC(y, m - 1, d + 1, 0, 0, 0));
  const offsetMinutes = getEasternOffsetMinutes(guessUTC);
  return new Date(guessUTC.getTime() - offsetMinutes * 60_000);
}

export function getMsUntilNextEasternMidnight(from: Date = new Date()): number {
  return getNextEasternMidnight(from).getTime() - from.getTime();
}

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

// Formats a plain YYYY-MM-DD date string (as produced by this module) as
// e.g. "Oct 29" — pure string parsing, deliberately not routed through a
// Date/timeZone conversion, so the label can never drift from the exact
// date string a fetch actually used. Meant for debug labels (e.g. next to
// a "Today"/"Tomorrow" tab) that show which date is being requested.
export function formatEasternDateLabel(isoDate: string): string {
  const [, month, day] = isoDate.split("-").map(Number);
  return `${MONTH_LABELS[month - 1]} ${day}`;
}
