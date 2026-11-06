import {
  fetchRecentGames,
  fetchScores,
  fetchStandings,
} from "./sources/nhlApi";
import { fetchPlayoffOdds } from "./sources/hockeyStatsPlayoffOdds";
import { fetchStartingGoalies } from "./sources/dailyFaceoffGoalies";
import { getTodayEasternDate } from "./easternDate";
import type { NhlSnapshot } from "./types";

function reasonMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

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
    // their rollover timing. Same reasoning applied to dailyfaceoff.com's
    // implicit "today" below.
    fetchScores(getTodayEasternDate()),
    fetchPlayoffOdds(),
    fetchStartingGoalies(getTodayEasternDate()),
  ]);

  if (standingsResult.status === "rejected") {
    throw new Error(
      `NHL standings fetch failed: ${reasonMessage(standingsResult.reason)}`,
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
    // Each entry is only present when that source actually failed — lets the
    // UI show the real cause (e.g. a specific HTTP status or a bot-block
    // page) instead of just a generic "unavailable", which matters when a
    // failure only reproduces in one environment (e.g. production) and
    // can't be diagnosed by re-running the fetch locally.
    sourceErrors: {
      hockeyStats:
        playoffOddsResult.status === "rejected"
          ? reasonMessage(playoffOddsResult.reason)
          : undefined,
      recentGames:
        recentGamesResult.status === "rejected"
          ? reasonMessage(recentGamesResult.reason)
          : undefined,
      dailyFaceoff:
        goaliesResult.status === "rejected"
          ? reasonMessage(goaliesResult.reason)
          : undefined,
    },
  };
}
