import {
  fetchRecentGames,
  fetchScores,
  fetchStandings,
} from "./sources/nhlApi";
import { fetchPlayoffOdds } from "./sources/hockeyStatsPlayoffOdds";
import { fetchStartingGoalies } from "./sources/dailyFaceoffGoalies";
import { getTodayEasternDate } from "./easternDate";
import type { NhlSnapshot } from "./types";

export async function aggregateNhlSnapshot(): Promise<NhlSnapshot> {
  const standingsPromise = fetchStandings();
  // Needs the team list from standings, but still runs alongside the other
  // independent sources rather than after all of them.
  const recentGamesPromise = standingsPromise.then((teams) =>
    fetchRecentGames(teams.map((t) => t.teamAbbrev)),
  );

  const [
    standingsResult,
    recentGamesResult,
    scoresResult,
    playoffOddsResult,
    goaliesResult,
  ] = await Promise.allSettled([
    standingsPromise,
    recentGamesPromise,
    // NHL's own "now" alias lags behind the actual calendar day (observed
    // still returning yesterday's slate well after midnight ET), so this
    // asks for our own computed Eastern date explicitly instead of trusting
    // their rollover timing.
    fetchScores(getTodayEasternDate()),
    fetchPlayoffOdds(),
    fetchStartingGoalies(),
  ]);

  if (standingsResult.status === "rejected") {
    throw new Error(
      `NHL standings fetch failed: ${standingsResult.reason instanceof Error ? standingsResult.reason.message : standingsResult.reason}`,
    );
  }

  const games = scoresResult.status === "fulfilled" ? scoresResult.value : [];
  const playoffOddsByTeam =
    playoffOddsResult.status === "fulfilled"
      ? playoffOddsResult.value
      : new Map();
  const recentGamesByTeam =
    recentGamesResult.status === "fulfilled"
      ? recentGamesResult.value
      : new Map();

  const teams = standingsResult.value.map((team) => ({
    ...team,
    playoffOdds: playoffOddsByTeam.get(team.fullName) ?? null,
    recentGames: recentGamesByTeam.get(team.teamAbbrev) ?? null,
  }));

  const startingGoalies =
    goaliesResult.status === "fulfilled" ? goaliesResult.value : [];

  return {
    teams,
    games,
    startingGoalies,
    sources: {
      nhlApi: true,
      hockeyStats: playoffOddsResult.status === "fulfilled",
      recentGames: recentGamesResult.status === "fulfilled",
      dailyFaceoff: goaliesResult.status === "fulfilled",
    },
  };
}
