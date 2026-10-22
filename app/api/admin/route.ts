import { NextResponse } from "next/server"
import { isAdmin } from "@/lib/admin"
import { sql } from "@/lib/db"
import { randomId } from "@/lib/ids"
import type { AdminRoom } from "@/lib/types"

const ONLINE_MS = 45_000

async function listRooms(): Promise<AdminRoom[]> {
  const rooms = (await sql`
    SELECT r.id, r.name, r.master_token, r.created_at,
      (SELECT count(*)::int FROM lists l WHERE l.room_id = r.id) AS lists,
      (SELECT count(*)::int FROM tracks t WHERE t.room_id = r.id) AS tracks
    FROM rooms r ORDER BY r.created_at DESC`) as Omit<AdminRoom, "layers" | "people">[]
  const layers = (await sql`
    SELECT s.room_id, s.layer, s.label, s.paused, t.title
    FROM layer_state s LEFT JOIN tracks t ON t.id = s.track_id
    WHERE s.youtube_id IS NOT NULL ORDER BY s.layer`) as (AdminRoom["layers"][number] & { room_id: string })[]
  const people = (await sql`
    SELECT room_id, nickname, audio_ok FROM presence
    WHERE last_seen_ms > ${Date.now() - ONLINE_MS} ORDER BY nickname`) as { room_id: string; nickname: string; audio_ok: boolean }[]
  return rooms.map((room) => ({
    ...room,
    layers: layers.filter((l) => l.room_id === room.id).map(({ layer, label, title, paused }) => ({ layer, label, title, paused })),
    people: people
      .filter((p) => p.room_id === room.id)
      .map(({ nickname, audio_ok }) => ({ nickname, audio_ok, is_master: nickname === "Mestre" })),
  }))
}

export async function POST(request: Request) {
  if (!process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "O painel está desligado: falta configurar ADMIN_PASSWORD" }, { status: 503 })
  }
  if (!isAdmin(request)) return NextResponse.json({ error: "Entre com a senha" }, { status: 401 })
  const body = (await request.json().catch(() => ({}))) as { action?: unknown; roomId?: unknown; name?: unknown }
  const roomId = typeof body.roomId === "string" ? body.roomId : ""

  switch (body.action) {
    case "list":
      break
    case "rename": {
      const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : ""
      if (!name) return NextResponse.json({ error: "Nome inválido" }, { status: 400 })
      await sql`UPDATE rooms SET name = ${name} WHERE id = ${roomId}`
      break
    }
    case "resetMaster":
      // For a leaked master link: the old one stops working right away.
      await sql`UPDATE rooms SET master_token = ${randomId(28)} WHERE id = ${roomId}`
      break
    case "delete":
      await sql`DELETE FROM rooms WHERE id = ${roomId}`
      break
    default:
      return NextResponse.json({ error: "Ação desconhecida" }, { status: 400 })
  }
  return NextResponse.json({ rooms: await listRooms() })
}
