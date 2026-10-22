import { NextResponse } from "next/server"
import { sql } from "@/lib/db"

// Tells the home page which of the rooms saved in this browser still exist, with their current names.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { tokens?: unknown }
  const tokens = Array.isArray(body.tokens)
    ? body.tokens.filter((t): t is string => typeof t === "string" && t.length <= 64).slice(0, 50)
    : []
  if (!tokens.length) return NextResponse.json({ rooms: [] })
  const rooms = (await sql`SELECT id AS "roomId", master_token AS "masterToken", name FROM rooms WHERE master_token = ANY(${tokens})`) as {
    roomId: string
    masterToken: string
    name: string
  }[]
  return NextResponse.json({ rooms })
}
