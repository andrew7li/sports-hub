import { refreshNhlData } from "@/lib/nhl/store";

// Called by scripts/scrape-goalies.ts (from GitHub Actions) right after it
// finishes writing fresh goalie data to Redis — this is the "trigger" half
// of that handoff. Pulls the new data into the app's in-memory snapshot
// immediately, so the next page load/reload already reflects it instead of
// waiting for the 4-hour background refresh or a manual "Refresh now" click.
export async function POST(request: Request) {
  const secret = process.env.SCRAPE_CALLBACK_SECRET;
  if (!secret) {
    return new Response("SCRAPE_CALLBACK_SECRET is not set", { status: 500 });
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    await refreshNhlData();
    return new Response(null, { status: 204 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(message, { status: 500 });
  }
}
