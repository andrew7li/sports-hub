export async function register() {
  // Only run the background scheduler in the long-running Node server, never
  // in the edge runtime (and never twice, if this module gets re-evaluated).
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const g = globalThis as unknown as { __sportshubSchedulerStarted?: boolean };
  if (g.__sportshubSchedulerStarted) return;
  g.__sportshubSchedulerStarted = true;

  const { refreshNhlData } = await import("./lib/nhl/store");
  const { getMsUntilNextEasternMidnight } = await import(
    "./lib/nhl/easternDate"
  );

  await refreshNhlData();

  // Scrapes run once a day, at 12:00 AM Eastern — re-reading the delay to
  // the next midnight each time (rather than a flat setInterval) keeps this
  // correctly aligned across DST transitions, where a "day" is 23 or 25
  // real hours.
  function scheduleNextScrape() {
    setTimeout(async () => {
      await refreshNhlData();
      scheduleNextScrape();
    }, getMsUntilNextEasternMidnight());
  }
  scheduleNextScrape();
}
