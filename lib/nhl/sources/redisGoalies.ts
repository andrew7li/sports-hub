import { getRedisClient } from "@/lib/redis/client";
import type { GoaliesRedisPayload, StartingGoalieMatchup } from "../types";

// Reads what scripts/scrape-goalies.ts (run from GitHub Actions, not
// Vercel) wrote for a given date. The app no longer scrapes
// dailyfaceoff.com directly — that 403s from Vercel's IP range — so this is
// now the only way goalie data reaches the UI.
export async function fetchGoaliesFromRedis(
  date: string,
): Promise<StartingGoalieMatchup[]> {
  const redis = getRedisClient();
  const raw = await redis.get(`goalies:${date}`);
  if (!raw) {
    throw new Error(
      `No scraped goalie data in Redis for ${date} yet — trigger a scrape first.`,
    );
  }

  const payload = JSON.parse(raw) as GoaliesRedisPayload;
  return payload.matchups;
}

// Like fetchGoaliesFromRedis, but returns null instead of throwing when
// nothing's there yet, and includes scrapedAt — for polling after a manual
// trigger, where "not there yet" is an expected, non-error state and the
// caller needs to tell *which* scrape it's looking at.
export async function fetchGoaliesPayloadFromRedis(
  date: string,
): Promise<GoaliesRedisPayload | null> {
  const redis = getRedisClient();
  const raw = await redis.get(`goalies:${date}`);
  return raw ? (JSON.parse(raw) as GoaliesRedisPayload) : null;
}
