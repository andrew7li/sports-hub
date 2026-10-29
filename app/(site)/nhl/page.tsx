import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { getNhlState } from "@/lib/nhl/store";
import type { AggregatedTeam, GameSummary, RecentGame } from "@/lib/nhl/types";
import { getSport } from "@/lib/sports";
import { SportHeading } from "@/app/components/ComingSoon";
import { CollapsedRows } from "@/app/components/CollapsedRows";
import { RefreshButton } from "@/app/components/RefreshButton";
import { GoaliesTabs } from "@/app/components/GoaliesTabs";
import { GamesTabs } from "@/app/components/GamesTabs";
import { RegressionPicksTabs } from "@/app/components/RegressionPicksTabs";
import { FatiguePicksTabs } from "@/app/components/FatiguePicksTabs";
import { TeamLogo } from "@/app/components/TeamLogo";
import { DeltaBadge, FatigueBadge } from "@/app/components/Badges";
import {
  NHL_TIME_ZONE as TIME_ZONE,
  getNextEasternMidnight,
  getTodayEasternDate,
  getTomorrowEasternDate,
} from "@/lib/nhl/easternDate";
import {
  RECENT_GAME_COUNT,
  FATIGUE_WINDOW_DAYS,
  FATIGUE_GAME_THRESHOLD,
  TOP_PICKS_COUNT,
  buildFormRows,
  computeFatiguePicks,
  computeRegressionOverPicks,
  computeRegressionUnderPicks,
  type RecentFormRow,
} from "@/lib/nhl/picks";
import {
  getTomorrowFatiguePicksAction,
  getTomorrowGamesAction,
  getTomorrowGoaliesAction,
  getTomorrowRegressionOverPicksAction,
  getTomorrowRegressionUnderPicksAction,
  refreshNhlAction,
} from "./actions";

export const metadata: Metadata = { title: "NHL" };

export default function NhlPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-4 py-10 sm:px-6">
      <SportHeading sport={getSport("nhl")} />
      <Suspense fallback={<NhlSkeleton />}>
        <NhlView />
      </Suspense>
    </main>
  );
}

async function NhlView() {
  // Forces this to run at request time: the in-memory store mutates on its
  // own (background scrape, admin refresh), so a plain synchronous read
  // would otherwise be treated as a static value and frozen at build time.
  await connection();

  const state = getNhlState();

  if (!state.snapshot) {
    return (
      <p className="rounded-2xl border border-dashed border-line px-6 py-16 text-center text-muted">
        No data yet — the first scrape hasn&apos;t completed. Reload in a
        moment.
      </p>
    );
  }

  const { snapshot } = state;
  const logos = new Map(snapshot.teams.map((t) => [t.teamAbbrev, t.logo]));
  const conferences = groupBy(snapshot.teams, (t) => t.conferenceName);

  const todayOpponents = new Map<string, string>();
  for (const game of snapshot.games) {
    todayOpponents.set(game.awayTeam.abbrev, `@ ${game.homeTeam.abbrev}`);
    todayOpponents.set(game.homeTeam.abbrev, `vs ${game.awayTeam.abbrev}`);
  }
  // Computed once and shared: the Last-5-games table displays every row, and
  // the picks sections below look up specific teams by abbreviation to score
  // today's games.
  const formRows = buildFormRows(snapshot.teams, todayOpponents);
  const formRowsByTeam = new Map(formRows.map((r) => [r.team.teamAbbrev, r]));
  const todayOverPicks = computeRegressionOverPicks(
    snapshot.games,
    formRowsByTeam,
    TOP_PICKS_COUNT,
  );
  const todayUnderPicks = computeRegressionUnderPicks(
    snapshot.games,
    formRowsByTeam,
    TOP_PICKS_COUNT,
  );
  const todayFatiguePicks = computeFatiguePicks(
    snapshot.games,
    formRowsByTeam,
    TOP_PICKS_COUNT,
  );
  const todayDate = getTodayEasternDate();
  const tomorrowDate = getTomorrowEasternDate();

  return (
    <div className="flex flex-col gap-12">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3">
        <p className="text-sm text-muted">
          Updated{" "}
          <span className="text-foreground">
            {state.lastUpdated?.toLocaleString("en-US", {
              timeZone: TIME_ZONE,
              dateStyle: "medium",
              timeStyle: "short",
            }) ?? "never"}{" "}
            ET
          </span>
          {state.lastError && (
            <span className="text-red-500">
              {" "}
              · last refresh failed: {state.lastError}
            </span>
          )}
          <span className="text-muted">
            {" "}
            · Next scrape{" "}
            <span className="text-foreground">
              {getNextEasternMidnight().toLocaleString("en-US", {
                timeZone: TIME_ZONE,
                dateStyle: "medium",
                timeStyle: "short",
              })}{" "}
              ET
            </span>
          </span>
        </p>
        <form action={refreshNhlAction}>
          <RefreshButton />
        </form>
      </div>

      <section>
        <SectionTitle>Top picks: regression overs</SectionTitle>
        <p className="-mt-2 mb-4 text-sm text-muted">
          Both teams have scored below their season average over their last{" "}
          {RECENT_GAME_COUNT} games — due to regress upward. Edge is the
          combined gap below their season GF/G.
        </p>
        <RegressionPicksTabs
          todayItems={todayOverPicks}
          todaySourceAvailable={snapshot.sources.recentGames}
          todayDate={todayDate}
          tomorrowDate={tomorrowDate}
          logos={logos}
          fetchTomorrow={getTomorrowRegressionOverPicksAction}
          emptyMessage="No picks today — no game has both teams scoring below their season average right now."
          unavailableMessage="NHL schedule data was unavailable."
        />
      </section>

      <section>
        <SectionTitle>Top picks: regression unders</SectionTitle>
        <p className="-mt-2 mb-4 text-sm text-muted">
          Both teams have scored above their season average over their last{" "}
          {RECENT_GAME_COUNT} games — due to cool off. Edge is the combined
          gap above their season GF/G.
        </p>
        <RegressionPicksTabs
          todayItems={todayUnderPicks}
          todaySourceAvailable={snapshot.sources.recentGames}
          todayDate={todayDate}
          tomorrowDate={tomorrowDate}
          logos={logos}
          fetchTomorrow={getTomorrowRegressionUnderPicksAction}
          emptyMessage="No picks today — no game has both teams scoring above their season average right now."
          unavailableMessage="NHL schedule data was unavailable."
        />
      </section>

      <section>
        <SectionTitle>Top picks: fatigue</SectionTitle>
        <p className="-mt-2 mb-4 text-sm text-muted">
          Games where exactly one team has played {FATIGUE_GAME_THRESHOLD}+
          games in the last {FATIGUE_WINDOW_DAYS} days — a rest edge for their
          opponent. Sorted by how fatigued the tired team is.
        </p>
        <FatiguePicksTabs
          todayItems={todayFatiguePicks}
          todaySourceAvailable={snapshot.sources.recentGames}
          todayDate={todayDate}
          tomorrowDate={tomorrowDate}
          logos={logos}
          fetchTomorrow={getTomorrowFatiguePicksAction}
        />
      </section>

      <section>
        <SectionTitle>Games</SectionTitle>
        <GamesTabs
          todayGames={snapshot.games}
          todayDate={todayDate}
          tomorrowDate={tomorrowDate}
          logos={logos}
          fetchTomorrow={getTomorrowGamesAction}
        />
      </section>

      <section>
        <SectionTitle>Starting goalies</SectionTitle>
        <GoaliesTabs
          todayMatchups={snapshot.startingGoalies}
          todaySourceAvailable={snapshot.sources.dailyFaceoff}
          todayDate={todayDate}
          tomorrowDate={tomorrowDate}
          logos={logos}
          fetchTomorrow={getTomorrowGoaliesAction}
        />
      </section>

      <RecentFormSection
        rows={formRows}
        sourceAvailable={snapshot.sources.recentGames}
      />

      <section>
        <SectionTitle>Standings</SectionTitle>
        {!snapshot.sources.hockeyStats && (
          <p className="mb-3 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
            Playoff odds source (hockeystats.com) was unavailable on the last
            refresh.
          </p>
        )}
        <div className="grid gap-6 xl:grid-cols-2">
          {[...conferences].map(([conference, teams]) => (
            <StandingsTable key={conference} title={conference} teams={teams} />
          ))}
        </div>
      </section>
    </div>
  );
}

function StandingsTable({
  title,
  teams,
}: {
  title: string;
  teams: AggregatedTeam[];
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-line">
      <h3 className="border-b border-line bg-surface px-4 py-2.5 text-sm font-semibold">
        {title} Conference
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-sm tabular-nums">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-muted">
              <th className="py-2 pl-4 pr-2 font-medium">#</th>
              <th className="py-2 pr-4 font-medium">Team</th>
              <th className="py-2 pr-3 text-right font-medium">GP</th>
              <th className="py-2 pr-3 text-right font-medium">W</th>
              <th className="py-2 pr-3 text-right font-medium">L</th>
              <th className="py-2 pr-3 text-right font-medium">OTL</th>
              <th className="py-2 pr-4 text-right font-medium">PTS</th>
              <th className="py-2 pr-4 font-medium">Playoff</th>
              <th className="py-2 pr-4 text-right font-medium">Cup</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((team, i) => (
              <tr
                key={team.teamAbbrev}
                className="border-t border-line hover:bg-surface-hover"
              >
                <td className="py-2 pl-4 pr-2 text-muted">{i + 1}</td>
                <td className="py-2 pr-4">
                  <span className="flex items-center gap-2.5">
                    <TeamLogo src={team.logo} abbrev={team.teamAbbrev} />
                    <span className="font-medium">{team.fullName}</span>
                  </span>
                </td>
                <td className="py-2 pr-3 text-right">{team.gamesPlayed}</td>
                <td className="py-2 pr-3 text-right">{team.wins}</td>
                <td className="py-2 pr-3 text-right">{team.losses}</td>
                <td className="py-2 pr-3 text-right">{team.otLosses}</td>
                <td className="py-2 pr-4 text-right font-semibold">
                  {team.points}
                </td>
                <td className="py-2 pr-4">
                  {team.playoffOdds ? (
                    <OddsBar value={team.playoffOdds.playoffProbability} />
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td className="py-2 pr-4 text-right">
                  {team.playoffOdds
                    ? `${team.playoffOdds.stanleyCupProbability.toFixed(1)}%`
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Teams shown at each end (coldest and hottest) before the rest collapse.
const EXTREME_COUNT = 5;

function RecentFormSection({
  rows: unsortedRows,
  sourceAvailable,
}: {
  rows: RecentFormRow[];
  sourceAvailable: boolean;
}) {
  const rows = [...unsortedRows].sort((a, b) => a.delta - b.delta);

  // Only the extremes are interesting for regression spotting; the middle of
  // the pack stays collapsed until asked for. Clamped so the two ends never
  // overlap when fewer than 2 × EXTREME_COUNT teams have data.
  const edge = Math.min(EXTREME_COUNT, Math.floor(rows.length / 2));
  const coldest = rows.slice(0, edge);
  const middle = rows.slice(edge, rows.length - edge);
  const hottest = rows.slice(rows.length - edge);

  return (
    <section>
      <SectionTitle>Last {RECENT_GAME_COUNT} games</SectionTitle>
      <p className="-mt-2 mb-4 text-sm text-muted">
        Goals per game over each team&apos;s last {RECENT_GAME_COUNT}{" "}
        regular-season games vs. their season average. Showing the{" "}
        {EXTREME_COUNT} coldest (top) and {EXTREME_COUNT} hottest (bottom)
        teams; the middle of the pack is collapsed.
      </p>
      {!sourceAvailable && (
        <p className="mb-3 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
          NHL schedule data was unavailable on the last refresh.
        </p>
      )}
      {rows.length === 0 ? (
        <p className="text-sm text-muted">No completed games yet.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-line">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-sm tabular-nums">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted">
                  <ColumnHeader
                    className="pl-4"
                    tip="Teams are sorted by Δ, coldest first."
                  >
                    Team
                  </ColumnHeader>
                  <ColumnHeader tip="Today's opponent, if the team plays today. @ = away, vs = home.">
                    Today
                  </ColumnHeader>
                  <ColumnHeader
                    tip={`Games played in the last ${FATIGUE_WINDOW_DAYS} days. Flagged at ${FATIGUE_GAME_THRESHOLD}+ — likely fatigued.`}
                  >
                    Rest
                  </ColumnHeader>
                  <ColumnHeader
                    align="right"
                    tip={`Wins-Losses-OT/shootout losses over the last ${RECENT_GAME_COUNT} games.`}
                  >
                    Record
                  </ColumnHeader>
                  <ColumnHeader
                    align="right"
                    tip={`Total goals scored over the last ${RECENT_GAME_COUNT} games.`}
                  >
                    GF
                  </ColumnHeader>
                  <ColumnHeader
                    align="right"
                    tip={`Goals scored per game over the last ${RECENT_GAME_COUNT} games.`}
                  >
                    GF/G
                  </ColumnHeader>
                  <ColumnHeader
                    align="right"
                    tip="Goals scored per game across the whole regular season."
                  >
                    Season
                  </ColumnHeader>
                  <ColumnHeader
                    align="right"
                    tip={`Last-${RECENT_GAME_COUNT} GF/G minus season GF/G. Blue = scoring 0.5+ below their average; orange = 0.5+ above.`}
                  >
                    Δ
                  </ColumnHeader>
                  <ColumnHeader
                    align="right"
                    tip={`Goals allowed per game over the last ${RECENT_GAME_COUNT} games.`}
                  >
                    GA/G
                  </ColumnHeader>
                  <ColumnHeader
                    align="right-edge"
                    tip="Each game's result and score (team's goals first), newest on the left. OT = overtime or shootout loss. Hover a chip for the date and opponent."
                  >
                    Results (newest first)
                  </ColumnHeader>
                </tr>
              </thead>
              <tbody>
                {coldest.map((row) => (
                  <RecentFormTableRow key={row.team.teamAbbrev} row={row} />
                ))}
                <CollapsedRows count={middle.length} colSpan={10}>
                  {middle.map((row) => (
                    <RecentFormTableRow key={row.team.teamAbbrev} row={row} />
                  ))}
                </CollapsedRows>
                {hottest.map((row) => (
                  <RecentFormTableRow key={row.team.teamAbbrev} row={row} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

function ColumnHeader({
  children,
  tip,
  align = "left",
  className = "",
}: {
  children: React.ReactNode;
  tip: string;
  // "right-edge" anchors the popover to the right so the last column's tip
  // doesn't spill past the table, while the header text stays left-aligned.
  align?: "left" | "right" | "right-edge";
  className?: string;
}) {
  return (
    <th
      className={`py-2 pr-4 font-medium ${align === "right" ? "text-right" : ""} ${className}`}
    >
      {/* Focusable so the tip also opens on keyboard focus and on tap for
          touch screens, where there's no hover. */}
      <span
        tabIndex={0}
        className="group relative inline-block cursor-help outline-none"
      >
        <span className="underline decoration-dotted underline-offset-4">
          {children}
        </span>
        <span
          role="tooltip"
          className={`pointer-events-none invisible absolute top-full z-10 mt-1.5 w-56 rounded-lg border border-line bg-background px-3 py-2 text-left text-xs font-normal normal-case tracking-normal text-foreground opacity-0 shadow-lg transition-opacity group-hover:visible group-hover:opacity-100 group-focus:visible group-focus:opacity-100 ${
            align === "left" ? "left-0" : "right-0"
          }`}
        >
          {tip}
        </span>
      </span>
    </th>
  );
}

function RecentFormTableRow({ row }: { row: RecentFormRow }) {
  const { team, record } = row;

  return (
    <tr className="border-t border-line hover:bg-surface-hover">
      <td className="py-2 pl-4 pr-4">
        <span className="flex items-center gap-2.5">
          <TeamLogo src={team.logo} abbrev={team.teamAbbrev} />
          <span className="font-medium">{team.fullName}</span>
        </span>
      </td>
      <td className="py-2 pr-4">
        {row.todayOpponent ? (
          <span className="font-medium">{row.todayOpponent}</span>
        ) : (
          <span className="text-muted">—</span>
        )}
      </td>
      <td className="py-2 pr-4">
        <FatigueBadge
          count={row.gamesInFatigueWindow}
          fatigued={row.fatigued}
        />
      </td>
      <td className="py-2 pr-4 text-right">
        {record.wins}-{record.losses}-{record.otLosses}
      </td>
      <td className="py-2 pr-4 text-right">{row.goalsFor}</td>
      <td className="py-2 pr-4 text-right font-semibold">
        {row.recentGfPerGame.toFixed(2)}
      </td>
      <td className="py-2 pr-4 text-right text-muted">
        {row.seasonGfPerGame.toFixed(2)}
      </td>
      <td className="py-2 pr-4 text-right">
        <DeltaBadge value={row.delta} />
      </td>
      <td className="py-2 pr-4 text-right text-muted">
        {row.recentGaPerGame.toFixed(2)}
      </td>
      <td className="py-2 pr-4">
        <span className="flex gap-1">
          {row.games.map((game) => (
            <ResultChip key={game.id} game={game} />
          ))}
        </span>
      </td>
    </tr>
  );
}

function ResultChip({ game }: { game: RecentGame }) {
  const tone =
    game.result === "W"
      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
      : game.result === "OTL"
        ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
        : "bg-red-500/10 text-red-600 dark:text-red-400";

  return (
    <span
      title={`${game.gameDate} ${game.isHome ? "vs" : "@"} ${game.opponentAbbrev}`}
      className={`whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-medium ${tone}`}
    >
      {game.result === "OTL" ? "OT" : game.result} {game.goalsFor}-
      {game.goalsAgainst}
    </span>
  );
}

function OddsBar({ value }: { value: number }) {
  return (
    <span className="flex items-center gap-2">
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-surface">
        <span
          className="block h-full rounded-full bg-gradient-to-r from-sky-500 to-cyan-400"
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </span>
      <span className="w-12 text-right text-xs">{value.toFixed(1)}%</span>
    </span>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-4 text-lg font-semibold">{children}</h2>;
}

function NhlSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-6">
      <div className="h-12 rounded-xl bg-surface" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="h-28 rounded-xl bg-surface" />
        ))}
      </div>
      <div className="h-96 rounded-xl bg-surface" />
    </div>
  );
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    groups.set(k, [...(groups.get(k) ?? []), item]);
  }
  return groups;
}
