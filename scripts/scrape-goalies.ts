// Standalone script — run by the GitHub Actions workflow (not by the Next.js
// app itself), from an IP that isn't Vercel's, since dailyfaceoff.com's bot
// protection blocks requests from Vercel's shared range. Scrapes starting
// goalies for one date and writes the result to Redis, where the app reads
// it from.
//
// Usage: tsx scripts/scrape-goalies.ts [YYYY-MM-DD]
// Defaults to today's Eastern date when no argument is given.
// Requires REDIS_URL in the environment.

import Redis from "ioredis";
import { fetchStartingGoalies } from "../lib/nhl/sources/dailyFaceoffGoalies";
import { getTodayEasternDate } from "../lib/nhl/easternDate";

// Starting goalies for a given date stop being useful once that date has
// passed — this just keeps the keyspace from accumulating forever.
const KEY_TTL_SECONDS = 3 * 24 * 60 * 60;

function redisKey(date: string): string {
  return `goalies:${date}`;
}

async function main() {
  const date = process.argv[2] || getTodayEasternDate();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Expected a YYYY-MM-DD date argument, got: "${date}"`);
  }

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error("REDIS_URL is not set");
  }

  console.log(`Scraping starting goalies for ${date}...`);
  const matchups = await fetchStartingGoalies(date);
  console.log(`Fetched ${matchups.length} matchup(s) for ${date}`);

  const redis = new Redis(redisUrl, { maxRetriesPerRequest: 2 });
  redis.on("error", (err) => console.error("Redis connection error:", err.message));

  try {
    const payload = JSON.stringify({
      date,
      matchups,
      scrapedAt: new Date().toISOString(),
    });
    const key = redisKey(date);
    await redis.set(key, payload, "EX", KEY_TTL_SECONDS);
    console.log(`Wrote ${key} (${payload.length} bytes, expires in ${KEY_TTL_SECONDS}s)`);
  } finally {
    redis.disconnect();
  }
}

main().catch((err) => {
  console.error("scrape-goalies failed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
