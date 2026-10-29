import { getTodayEasternDate } from "./easternDate";
import type { AggregatedTeam, GameSummary, RecentGame } from "./types";

export const RECENT_GAME_COUNT = 5;
// "3 games in 5 days" — a team at or above this is flagged as fatigued.
export const FATIGUE_WINDOW_DAYS = 5;
export const FATIGUE_GAME_THRESHOLD = 3;
export const TOP_PICKS_COUNT = 3;

export type RecentFormRow = {
  team: AggregatedTeam;
  games: RecentGame[];
  record: { wins: number; losses: number; otLosses: number };
  goalsFor: number;
  recentGfPerGame: number;
  recentGaPerGame: number;
  seasonGfPerGame: number;
  // Recent minus season GF/G. Negative means the team has been scoring below
  // its season average — the "due to regress upward" candidates. Positive
  // means scoring above it — the "due to cool off" candidates.
  delta: number;
  todayOpponent: string | null;
  gamesInFatigueWindow: number;
  fatigued: boolean;
};

export function recentFormRow(
  team: AggregatedTeam,
  todayOpponents: Map<string, string>,
): RecentFormRow | null {
  const games = team.recentGames;
  if (!games || games.length === 0 || team.gamesPlayed === 0) return null;

  const goalsFor = games.reduce((sum, g) => sum + g.goalsFor, 0);
  const goalsAgainst = games.reduce((sum, g) => sum + g.goalsAgainst, 0);
  const recentGfPerGame = goalsFor / games.length;
  const seasonGfPerGame = team.goalsFor / team.gamesPlayed;
  const gamesInFatigueWindow = gamesPlayedWithinDays(
    games,
    getTodayEasternDate(),
    FATIGUE_WINDOW_DAYS,
  );

  return {
    team,
    games,
    record: {
      wins: games.filter((g) => g.result === "W").length,
      losses: games.filter((g) => g.result === "L").length,
      otLosses: games.filter((g) => g.result === "OTL").length,
    },
    goalsFor,
    recentGfPerGame,
    recentGaPerGame: goalsAgainst / games.length,
    seasonGfPerGame,
    delta: recentGfPerGame - seasonGfPerGame,
    todayOpponent: todayOpponents.get(team.teamAbbrev) ?? null,
    gamesInFatigueWindow,
    fatigued: gamesInFatigueWindow >= FATIGUE_GAME_THRESHOLD,
  };
}

// Both dates are plain YYYY-MM-DD strings (Eastern calendar dates), so the
// day gap is just a whole-day difference between the two UTC midnights.
export function gamesPlayedWithinDays(
  games: RecentGame[],
  asOfDate: string,
  windowDays: number,
): number {
  const asOfMs = Date.parse(`${asOfDate}T00:00:00Z`);
  return games.filter((game) => {
    const gameMs = Date.parse(`${game.gameDate}T00:00:00Z`);
    const dayGap = Math.round((asOfMs - gameMs) / 86_400_000);
    return dayGap >= 0 && dayGap < windowDays;
  }).length;
}

export function buildFormRows(
  teams: AggregatedTeam[],
  opponentsByTeam: Map<string, string>,
): RecentFormRow[] {
  return teams.flatMap((team) => {
    const row = recentFormRow(team, opponentsByTeam);
    return row ? [row] : [];
  });
}

export type RegressionPick = {
  game: GameSummary;
  homeRow: RecentFormRow;
  awayRow: RecentFormRow;
  // Combined magnitude of both teams' delta — bigger means both teams are
  // further from their season scoring average, which is a bigger expected
  // regression toward the mean in that game.
  edge: number;
  pick: "OVER" | "UNDER";
};

function computeRegressionPicks(
  games: GameSummary[],
  formRowsByTeam: Map<string, RecentFormRow>,
  count: number,
  trend: "cold" | "hot",
): RegressionPick[] {
  const pick = trend === "cold" ? "OVER" : "UNDER";
  const candidates: RegressionPick[] = [];
  for (const game of games) {
    const homeRow = formRowsByTeam.get(game.homeTeam.abbrev);
    const awayRow = formRowsByTeam.get(game.awayTeam.abbrev);
    if (!homeRow || !awayRow) continue;
    const bothQualify =
      trend === "cold"
        ? homeRow.delta < 0 && awayRow.delta < 0
        : homeRow.delta > 0 && awayRow.delta > 0;
    if (!bothQualify) continue;
    candidates.push({
      game,
      homeRow,
      awayRow,
      edge: Math.abs(homeRow.delta) + Math.abs(awayRow.delta),
      pick,
    });
  }
  return candidates.sort((a, b) => b.edge - a.edge).slice(0, count);
}

// Both teams scoring below their season average → due to regress upward.
export function computeRegressionOverPicks(
  games: GameSummary[],
  formRowsByTeam: Map<string, RecentFormRow>,
  count: number,
): RegressionPick[] {
  return computeRegressionPicks(games, formRowsByTeam, count, "cold");
}

// Both teams scoring above their season average → due to cool off.
export function computeRegressionUnderPicks(
  games: GameSummary[],
  formRowsByTeam: Map<string, RecentFormRow>,
  count: number,
): RegressionPick[] {
  return computeRegressionPicks(games, formRowsByTeam, count, "hot");
}

export type FatiguePick = {
  game: GameSummary;
  tiredRow: RecentFormRow;
  restedRow: RecentFormRow;
  tiredIsHome: boolean;
};

// Flags games where exactly one side is fatigued — a two-sided fatigue
// matchup (or neither side fatigued) has no rest edge, so those are skipped.
// Ranked by how fatigued the tired team is (more games in the window first).
export function computeFatiguePicks(
  games: GameSummary[],
  formRowsByTeam: Map<string, RecentFormRow>,
  count: number,
): FatiguePick[] {
  const candidates: FatiguePick[] = [];
  for (const game of games) {
    const homeRow = formRowsByTeam.get(game.homeTeam.abbrev);
    const awayRow = formRowsByTeam.get(game.awayTeam.abbrev);
    if (!homeRow || !awayRow) continue;
    if (homeRow.fatigued === awayRow.fatigued) continue;

    const tiredIsHome = homeRow.fatigued;
    candidates.push({
      game,
      tiredRow: tiredIsHome ? homeRow : awayRow,
      restedRow: tiredIsHome ? awayRow : homeRow,
      tiredIsHome,
    });
  }
  return candidates
    .sort(
      (a, b) => b.tiredRow.gamesInFatigueWindow - a.tiredRow.gamesInFatigueWindow,
    )
    .slice(0, count);
}
