export type TeamStanding = {
  teamAbbrev: string;
  fullName: string;
  divisionName: string;
  conferenceName: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  otLosses: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  leagueSequence: number;
  logo: string;
};

export type PlayoffOdds = {
  playoffProbability: number;
  stanleyCupProbability: number;
  projectedPoints: number | null;
};

export type RecentGame = {
  id: number;
  gameDate: string;
  opponentAbbrev: string;
  isHome: boolean;
  goalsFor: number;
  goalsAgainst: number;
  // OTL covers both overtime and shootout losses, matching the standings.
  result: "W" | "L" | "OTL";
};

export type AggregatedTeam = TeamStanding & {
  playoffOdds: PlayoffOdds | null;
  // Most recent completed regular-season games, newest first. null when the
  // team's schedule couldn't be fetched on the last refresh.
  recentGames: RecentGame[] | null;
};

export type GameSummary = {
  id: number;
  gameState: string;
  startTimeUTC: string;
  awayTeam: { abbrev: string; name: string; score: number };
  homeTeam: { abbrev: string; name: string; score: number };
};

export type StartingGoalie = {
  teamAbbrev: string;
  teamName: string;
  goalieName: string;
  headshotUrl: string | null;
  wins: number;
  losses: number;
  overtimeLosses: number;
  savePercentage: number | null;
  goalsAgainstAverage: number | null;
  // dailyfaceoff's own confidence label, e.g. "Confirmed" / "Likely" /
  // "Unconfirmed" — passed through as-is rather than a fixed enum, since the
  // full set of values isn't documented anywhere.
  confirmation: string;
  newsDetails: string | null;
};

export type StartingGoalieMatchup = {
  gameDate: string;
  homeGoalie: StartingGoalie;
  awayGoalie: StartingGoalie;
};

export type NhlSnapshot = {
  teams: AggregatedTeam[];
  games: GameSummary[];
  startingGoalies: StartingGoalieMatchup[];
  sources: {
    nhlApi: boolean;
    hockeyStats: boolean;
    recentGames: boolean;
    dailyFaceoff: boolean;
  };
  // The actual rejection reason for each source that failed on the last
  // refresh, keyed the same as `sources` — undefined for a source that
  // succeeded (or hasn't failed yet). Exists so a failure can be diagnosed
  // from the UI itself rather than needing access to server logs.
  sourceErrors: {
    hockeyStats?: string;
    recentGames?: string;
    dailyFaceoff?: string;
  };
};
