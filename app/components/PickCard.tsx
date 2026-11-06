import {
  FATIGUE_DISPLAY_WINDOW_DAYS,
  type FatiguePick,
  type RecentFormRow,
  type RegressionPick,
} from "@/lib/nhl/picks";
import { DeltaBadge, FatigueBadge } from "./Badges";
import { TeamLogo } from "./TeamLogo";

export function RegressionPickCard({
  pick,
  logos,
}: {
  pick: RegressionPick;
  logos: Map<string, string>;
}) {
  const { game, homeRow, awayRow, edge, pick: label } = pick;
  const tone =
    label === "OVER"
      ? "bg-sky-500/10 text-sky-600 dark:text-sky-400"
      : "bg-orange-500/10 text-orange-600 dark:text-orange-400";

  return (
    <li className="rounded-xl border border-line p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>
          {label}
        </span>
        <span className="text-xs text-muted">
          Edge{" "}
          <span className="font-semibold text-foreground">
            {edge.toFixed(2)}
          </span>
        </span>
      </div>
      <div className="flex flex-col gap-2">
        <PickTeamRow row={awayRow} logo={logos.get(game.awayTeam.abbrev)} />
        <PickTeamRow row={homeRow} logo={logos.get(game.homeTeam.abbrev)} />
      </div>
    </li>
  );
}

export function FatiguePickCard({
  pick,
  logos,
}: {
  pick: FatiguePick;
  logos: Map<string, string>;
}) {
  const { tiredRow, restedRow } = pick;

  return (
    <li className="rounded-xl border border-line p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="rounded-full bg-violet-500/10 px-2.5 py-1 text-xs font-semibold text-violet-600 dark:text-violet-400">
          REST EDGE
        </span>
        <span className="text-xs text-muted">vs. well-rested opponent</span>
      </div>
      <div className="flex flex-col gap-2">
        <PickFatigueRow row={tiredRow} logo={logos.get(tiredRow.team.teamAbbrev)} />
        <PickFatigueRow row={restedRow} logo={logos.get(restedRow.team.teamAbbrev)} />
      </div>
    </li>
  );
}

function PickTeamRow({ row, logo }: { row: RecentFormRow; logo?: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-2.5">
        <TeamLogo src={logo} abbrev={row.team.teamAbbrev} />
        <span className="text-sm font-medium">{row.team.fullName}</span>
        {row.fatigued && <FatigueBadge match={row.fatigueMatches[0]} />}
      </span>
      <DeltaBadge value={row.delta} />
    </div>
  );
}

function PickFatigueRow({ row, logo }: { row: RecentFormRow; logo?: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-2.5">
        <TeamLogo src={logo} abbrev={row.team.teamAbbrev} />
        <span className="text-sm font-medium">{row.team.fullName}</span>
      </span>
      {row.fatigued ? (
        <FatigueBadge match={row.fatigueMatches[0]} />
      ) : (
        <span className="whitespace-nowrap rounded bg-emerald-500/10 px-1.5 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
          Rested ({row.gamesInDisplayWindow} in {FATIGUE_DISPLAY_WINDOW_DAYS}d)
        </span>
      )}
    </div>
  );
}
