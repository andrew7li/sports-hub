"use client";

import { useState, useTransition } from "react";
import type { GameSummary } from "@/lib/nhl/types";
import { NHL_TIME_ZONE, formatEasternDateLabel } from "@/lib/nhl/easternDate";
import { GameCard } from "./GameCard";

function easternDateOf(isoDateTime: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: NHL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(isoDateTime));
}

type Tab = "today" | "tomorrow";

type TomorrowState =
  | { status: "idle" }
  | {
      status: "loaded";
      games: GameSummary[];
      sourceAvailable: boolean;
      error?: string;
    }
  | { status: "error" };

export function GamesTabs({
  todayGames,
  todayDate,
  tomorrowDate,
  logos,
  fetchTomorrow,
}: {
  todayGames: GameSummary[];
  todayDate: string;
  tomorrowDate: string;
  logos: Map<string, string>;
  // A server action passed down from the page — keeps this component free of
  // its own "use server" import and of knowing anything about auth.
  fetchTomorrow: () => Promise<{
    games: GameSummary[];
    sourceAvailable: boolean;
    error?: string;
  }>;
}) {
  const [tab, setTab] = useState<Tab>("today");
  const [tomorrow, setTomorrow] = useState<TomorrowState>({ status: "idle" });
  const [isPending, startTransition] = useTransition();

  function selectTomorrow() {
    setTab("tomorrow");
    // Only fetch the first time this is clicked — a successful result stays
    // cached both here and server-side (until the calendar date rolls
    // over), so flipping back and forth never re-fetches. A failed attempt
    // is NOT treated as "idle" is gone forever within this view either —
    // reload the page to retry sooner than that.
    if (tomorrow.status === "idle") {
      startTransition(async () => {
        try {
          const result = await fetchTomorrow();
          setTomorrow({ status: "loaded", ...result });
        } catch {
          setTomorrow({ status: "error" });
        }
      });
    }
  }

  const sourceUrl =
    tab === "tomorrow" && tomorrow.status === "loaded" && tomorrow.games[0]
      ? `https://www.nhl.com/schedule/${easternDateOf(tomorrow.games[0].startTimeUTC)}`
      : "https://www.nhl.com/schedule";

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-full border border-line bg-surface p-1 text-sm">
          <button
            type="button"
            onClick={() => setTab("today")}
            className={`rounded-full px-3 py-1 font-medium transition-colors ${
              tab === "today"
                ? "bg-foreground text-background"
                : "text-muted hover:text-foreground"
            }`}
          >
            Today <span className="opacity-70">({formatEasternDateLabel(todayDate)})</span>
          </button>
          <button
            type="button"
            onClick={selectTomorrow}
            className={`rounded-full px-3 py-1 font-medium transition-colors ${
              tab === "tomorrow"
                ? "bg-foreground text-background"
                : "text-muted hover:text-foreground"
            }`}
          >
            Tomorrow{" "}
            <span className="opacity-70">({formatEasternDateLabel(tomorrowDate)})</span>
          </button>
        </div>
        <a
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted underline-offset-2 hover:text-foreground hover:underline"
        >
          Source: nhl.com ↗
        </a>
      </div>

      {tab === "today" && (
        <GameList
          games={todayGames}
          sourceAvailable
          logos={logos}
          emptyMessage="No games today."
        />
      )}

      {tab === "tomorrow" && (
        <>
          {isPending && tomorrow.status === "idle" && (
            <p className="text-sm text-muted">Loading tomorrow&apos;s games…</p>
          )}
          {tomorrow.status === "error" && (
            <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
              NHL schedule data was unavailable.
            </p>
          )}
          {tomorrow.status === "loaded" && (
            <GameList
              games={tomorrow.games}
              sourceAvailable={tomorrow.sourceAvailable}
              error={tomorrow.error}
              logos={logos}
              emptyMessage="No games scheduled tomorrow."
            />
          )}
        </>
      )}
    </div>
  );
}

function GameList({
  games,
  sourceAvailable,
  error,
  logos,
  emptyMessage,
}: {
  games: GameSummary[];
  sourceAvailable: boolean;
  error?: string;
  logos: Map<string, string>;
  emptyMessage: string;
}) {
  return (
    <>
      {!sourceAvailable && (
        <p className="mb-3 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
          NHL schedule data was unavailable on the last refresh.
          {error && <span className="block font-mono opacity-80">{error}</span>}
        </p>
      )}
      {games.length === 0 ? (
        <p className="text-sm text-muted">{emptyMessage}</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {games.map((game) => (
            <GameCard key={game.id} game={game} logos={logos} />
          ))}
        </ul>
      )}
    </>
  );
}
