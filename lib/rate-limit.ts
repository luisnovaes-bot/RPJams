import { createHash } from "node:crypto"
import { sql } from "./db"

/** The visitor's IP as Vercel reports it, hashed so it is never stored as is. */
export function clientKey(request: Request, action: string): string {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown"
  return createHash("sha256").update(`${action}:${ip}`).digest("hex")
}

/**
 * Sliding-window limit: true if this key did the action fewer than `limit` times in the
 * last `windowMs`, and records this attempt. Old rows are cleared on the way.
 */
export async function allow(key: string, limit: number, windowMs: number): Promise<boolean> {
  const now = Date.now()
  const since = now - windowMs
  await sql`DELETE FROM rate_events WHERE at_ms < ${now - 24 * 60 * 60_000}`
  const rows = (await sql`SELECT count(*)::int AS n FROM rate_events WHERE key = ${key} AND at_ms >= ${since}`) as { n: number }[]
  if (rows[0].n >= limit) return false
  await sql`INSERT INTO rate_events (key, at_ms) VALUES (${key}, ${now})`
  return true
}
