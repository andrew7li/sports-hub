import { aggregateNhlSnapshot } from "./aggregate";
import { fetchStartingGoalies } from "./sources/dailyFaceoffGoalies";
import { fetchScores } from "./sources/nhlApi";
import { getTomorrowEasternDate } from "./easternDate";
import type { GameSummary, NhlSnapshot, StartingGoalieMatchup } from "./types";

type NhlState = {
  snapshot: NhlSnapshot | null;
  lastUpdated: Date | null;
  lastError: string | null;
};

type TomorrowGoaliesCache = {
  date: string;
  matchups: StartingGoalieMatchup[];
  sourceAvailable: boolean;
  error?: string;
};

type TomorrowGamesCache = {
  date: string;
  games: GameSummary[];
  sourceAvailable: boolean;
  error?: string;
};

type GlobalStore = {
  __sportshubNhlState?: NhlState;
  __sportshubNhlInFlight?: Promise<void> | null;
  __sportshubTomorrowGoalies?: TomorrowGoaliesCache | null;
  __sportshubTomorrowGoaliesInFlight?: Promise<TomorrowGoaliesCache> | null;
  __sportshubTomorrowGames?: TomorrowGamesCache | null;
  __sportshubTomorrowGamesInFlight?: Promise<TomorrowGamesCache> | null;
};

// Single-process, in-memory only: there is no DB. State lives for as long as
// this server process runs and resets on restart/deploy — acceptable for the
// POC since there's exactly one long-running server instance.
//
// Stored on `globalThis` rather than a module-level variable: Next.js bundles
// instrumentation.ts and app/server code into separate layers, which can end
// up as separate module instances. `globalThis` guarantees one shared object
// regardless of which layer touches it.
const g = globalThis as unknown as GlobalStore;

if (!g.__sportshubNhlState) {
  g.__sportshubNhlState = {
    snapshot: null,
    lastUpdated: null,
    lastError: null,
  };
}

export function getNhlState(): NhlState {
  return g.__sportshubNhlState!;
}

// Collapses concurrent callers (e.g. the admin mashing "Refresh now") onto a
// single in-flight scrape instead of firing duplicate requests at the
// upstream sources. This is not a cooldown — once it resolves, the very next
// call starts a fresh scrape immediately.
export function refreshNhlData(): Promise<void> {
  if (g.__sportshubNhlInFlight) return g.__sportshubNhlInFlight;

  const state = getNhlState();

  g.__sportshubNhlInFlight = (async () => {
    try {
      state.snapshot = await aggregateNhlSnapshot();
      state.lastUpdated = new Date();
      state.lastError = null;
    } catch (err) {
      state.lastError = err instanceof Error ? err.message : String(err);
    } finally {
      g.__sportshubNhlInFlight = null;
    }
  })();

  return g.__sportshubNhlInFlight;
}

// Tomorrow's starting goalies are deliberately NOT part of the 4-hour
// background scrape — nobody looks at them most of the time, so fetching
// them on every cycle would just be wasted work against dailyfaceoff.com.
// Instead this fetches once, on the first "Tomorrow" click, and caches the
// result keyed by date; it only re-fetches once the calendar actually rolls
// over to a new "tomorrow".
export async function getOrFetchTomorrowGoalies(): Promise<TomorrowGoaliesCache> {
  const targetDate = getTomorrowEasternDate();

  if (g.__sportshubTomorrowGoalies?.date === targetDate) {
    return g.__sportshubTomorrowGoalies;
  }
  if (g.__sportshubTomorrowGoaliesInFlight) {
    return g.__sportshubTomorrowGoaliesInFlight;
  }

  g.__sportshubTomorrowGoaliesInFlight = (async () => {
    try {
      const matchups = await fetchStartingGoalies(targetDate);
      const result: TomorrowGoaliesCache = {
        date: targetDate,
        matchups,
        sourceAvailable: true,
      };
      // Only a successful fetch is cached — a failure (network blip, a
      // transient block, etc.) must not get "stuck" as unavailable for the
      // rest of the day with no way to retry.
      g.__sportshubTomorrowGoalies = result;
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("getOrFetchTomorrowGoalies failed:", message);
      return {
        date: targetDate,
        matchups: [],
        sourceAvailable: false,
        error: message,
      };
    } finally {
      g.__sportshubTomorrowGoaliesInFlight = null;
    }
  })();

  return g.__sportshubTomorrowGoaliesInFlight;
}

// Same lazy, cached-by-date pattern as tomorrow's goalies above: tomorrow's
// schedule isn't part of the 4-hour background scrape either, so it's only
// fetched once someone actually asks for it.
export async function getOrFetchTomorrowGames(): Promise<TomorrowGamesCache> {
  const targetDate = getTomorrowEasternDate();

  if (g.__sportshubTomorrowGames?.date === targetDate) {
    return g.__sportshubTomorrowGames;
  }
  if (g.__sportshubTomorrowGamesInFlight) {
    return g.__sportshubTomorrowGamesInFlight;
  }

  g.__sportshubTomorrowGamesInFlight = (async () => {
    try {
      const games = await fetchScores(targetDate);
      const result: TomorrowGamesCache = {
        date: targetDate,
        games,
        sourceAvailable: true,
      };
      // Only a successful fetch is cached, same reasoning as the goalies
      // cache above: a failed attempt must stay retryable.
      g.__sportshubTomorrowGames = result;
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("getOrFetchTomorrowGames failed:", message);
      return {
        date: targetDate,
        games: [],
        sourceAvailable: false,
        error: message,
      };
    } finally {
      g.__sportshubTomorrowGamesInFlight = null;
    }
  })();

  return g.__sportshubTomorrowGamesInFlight;
}
