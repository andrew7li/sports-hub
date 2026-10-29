"use server";

import { isAuthenticated } from "@/lib/auth/session";
import {
  getNhlState,
  getOrFetchTomorrowGames,
  getOrFetchTomorrowGoalies,
  refreshNhlData,
} from "@/lib/nhl/store";
import {
  buildFormRows,
  computeFatiguePicks,
  computeRegressionOverPicks,
  computeRegressionUnderPicks,
  TOP_PICKS_COUNT,
  type FatiguePick,
  type RecentFormRow,
  type RegressionPick,
} from "@/lib/nhl/picks";
import type {
  GameSummary,
  NhlSnapshot,
  StartingGoalieMatchup,
} from "@/lib/nhl/types";

async function requireAuth(): Promise<void> {
  // Re-check on the server: proxy.ts gates page requests, but a Server
  // Action is its own entry point and shouldn't rely on that alone.
  if (!(await isAuthenticated())) {
    throw new Error("Not authorized");
  }
}

export async function refreshNhlAction() {
  await requireAuth();
  await refreshNhlData();
}

export async function getTomorrowGoaliesAction(): Promise<{
  matchups: StartingGoalieMatchup[];
  sourceAvailable: boolean;
  error?: string;
}> {
  await requireAuth();
  return getOrFetchTomorrowGoalies();
}

export async function getTomorrowGamesAction(): Promise<{
  games: GameSummary[];
  sourceAvailable: boolean;
  error?: string;
}> {
  await requireAuth();
  return getOrFetchTomorrowGames();
}

type TomorrowPicksContext = {
  games: GameSummary[];
  snapshot: NhlSnapshot | null;
  formRowsByTeam: Map<string, RecentFormRow>;
  sourceAvailable: boolean;
  error?: string;
};

// Shared by the three pick actions below: recent-form data (last 5 games vs.
// season average) isn't date-specific, so it's recomputed fresh here from
// the current snapshot rather than cached — cheap in-memory math over data
// that's already in the store. Only tomorrow's game list is itself cached
// (by getOrFetchTomorrowGames).
async function getTomorrowPicksContext(): Promise<TomorrowPicksContext> {
  const {
    games,
    sourceAvailable: gamesAvailable,
    error,
  } = await getOrFetchTomorrowGames();

  const { snapshot } = getNhlState();
  const formRows = buildFormRows(snapshot?.teams ?? [], new Map());
  const formRowsByTeam = new Map(formRows.map((r) => [r.team.teamAbbrev, r]));

  return {
    games,
    snapshot,
    formRowsByTeam,
    sourceAvailable: gamesAvailable && snapshot?.sources.recentGames === true,
    error,
  };
}

export async function getTomorrowRegressionOverPicksAction(): Promise<{
  items: RegressionPick[];
  sourceAvailable: boolean;
  error?: string;
}> {
  await requireAuth();
  const { games, formRowsByTeam, sourceAvailable, error } =
    await getTomorrowPicksContext();
  return {
    items: computeRegressionOverPicks(games, formRowsByTeam, TOP_PICKS_COUNT),
    sourceAvailable,
    error,
  };
}

export async function getTomorrowRegressionUnderPicksAction(): Promise<{
  items: RegressionPick[];
  sourceAvailable: boolean;
  error?: string;
}> {
  await requireAuth();
  const { games, formRowsByTeam, sourceAvailable, error } =
    await getTomorrowPicksContext();
  return {
    items: computeRegressionUnderPicks(games, formRowsByTeam, TOP_PICKS_COUNT),
    sourceAvailable,
    error,
  };
}

export async function getTomorrowFatiguePicksAction(): Promise<{
  items: FatiguePick[];
  sourceAvailable: boolean;
  error?: string;
}> {
  await requireAuth();
  const { games, formRowsByTeam, sourceAvailable, error } =
    await getTomorrowPicksContext();
  return {
    items: computeFatiguePicks(games, formRowsByTeam, TOP_PICKS_COUNT),
    sourceAvailable,
    error,
  };
}
