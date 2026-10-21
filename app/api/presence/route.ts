import { NextResponse } from "next/server"
import { roomById, roomByMasterToken, sql } from "@/lib/db"

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    roomId?: unknown
    masterToken?: unknown
    clientId?: unknown
    nickname?: unknown
    audioOk?: unknown
    leaving?: unknown
  }
  const room =
    typeof body.masterToken === "string"
      ? await roomByMasterToken(body.masterToken)
      : typeof body.roomId === "string"
        ? await roomById(body.roomId)
        : undefined
  if (!room || typeof body.clientId !== "string" || body.clientId.length > 64) {
    return NextResponse.json({ error: "Pedido inválido" }, { status: 400 })
  }
  if (body.leaving === true) {
    await sql`DELETE FROM presence WHERE room_id = ${room.id} AND client_id = ${body.clientId}`
    return NextResponse.json({ ok: true })
  }
  const nickname = typeof body.nickname === "string" && body.nickname.trim() ? body.nickname.trim().slice(0, 40) : "Sem nome"
  const audioOk = body.audioOk === true
  await sql`
    INSERT INTO presence (room_id, client_id, nickname, audio_ok, last_seen_ms)
    VALUES (${room.id}, ${body.clientId}, ${nickname}, ${audioOk}, ${Date.now()})
    ON CONFLICT (room_id, client_id) DO UPDATE
    SET nickname = EXCLUDED.nickname, audio_ok = EXCLUDED.audio_ok, last_seen_ms = EXCLUDED.last_seen_ms`
  // Forget people who left without saying so, to keep the table small.
  await sql`DELETE FROM presence WHERE room_id = ${room.id} AND last_seen_ms < ${Date.now() - 10 * 60_000}`
  return NextResponse.json({ ok: true })
}
