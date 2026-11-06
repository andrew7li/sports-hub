"use client";

import { useState, useTransition } from "react";

type Result = { ok: boolean; error?: string };

// Kicks off the GitHub Actions scraper (runs on GitHub's IP range, not
// Vercel's, which is what actually gets past dailyfaceoff.com's bot
// protection) and writes into Redis. This button only fires the trigger —
// it doesn't yet read the result back, since the rest of the app isn't
// wired to read from Redis yet.
export function TriggerScrapeButton({
  trigger,
}: {
  trigger: () => Promise<Result>;
}) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<Result | null>(null);

  function handleClick() {
    setResult(null);
    startTransition(async () => {
      try {
        setResult(await trigger());
      } catch {
        setResult({ ok: false, error: "Request failed." });
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="rounded-full border border-line px-3 py-1.5 text-sm font-medium text-muted hover:cursor-pointer hover:bg-surface-hover hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Triggering…" : "Scrape goalies now"}
      </button>
      {result?.ok && (
        <span className="text-xs text-emerald-600 dark:text-emerald-400">
          Triggered — check the Actions tab, or Redis, in a minute.
        </span>
      )}
      {result && !result.ok && (
        <span className="text-xs text-red-600 dark:text-red-400">
          Failed: {result.error}
        </span>
      )}
    </div>
  );
}
