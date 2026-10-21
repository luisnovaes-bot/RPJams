import { NextResponse } from "next/server"
import { roomById, roomByMasterToken } from "@/lib/db"
import { layerStateQuery, presenceQuery, realtime } from "@/lib/realtime-server"

// Hands the browser a short-lived sealed live query. Players get the layer state of
// their room; the master token also unlocks who is connected.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { roomId?: unknown; masterToken?: unknown; kind?: unknown }
  if (body.kind === "presence") {
    const room = typeof body.masterToken === "string" ? await roomByMasterToken(body.masterToken) : undefined
    if (!room) return NextResponse.json({ error: "Sala não encontrada" }, { status: 404 })
    return NextResponse.json(await realtime.seal({ query: presenceQuery(room.id) }))
  }
  const room =
    typeof body.masterToken === "string"
      ? await roomByMasterToken(body.masterToken)
      : typeof body.roomId === "string"
        ? await roomById(body.roomId)
        : undefined
  if (!room) return NextResponse.json({ error: "Sala não encontrada" }, { status: 404 })
  return NextResponse.json(await realtime.seal({ query: layerStateQuery(room.id) }))
}
