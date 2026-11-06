import Redis from "ioredis";

type GlobalStore = { __sportshubRedis?: Redis };

// Stored on `globalThis`, same reasoning as the rest of this app's shared
// state: Next.js bundles different parts of the app (instrumentation,
// Server Components, Server Actions) into separate layers that can end up
// as separate module instances, and `globalThis` is what guarantees a
// single shared client across all of them within one process.
const g = globalThis as unknown as GlobalStore;

export function getRedisClient(): Redis {
  if (!g.__sportshubRedis) {
    const url = process.env.REDIS_URL;
    if (!url) {
      throw new Error("REDIS_URL is not set");
    }
    const client = new Redis(url, { maxRetriesPerRequest: 2 });
    client.on("error", (err) => {
      console.error("Redis client error:", err.message);
    });
    g.__sportshubRedis = client;
  }
  return g.__sportshubRedis;
}
