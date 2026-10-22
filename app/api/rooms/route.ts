import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { randomId } from "@/lib/ids"

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { name?: unknown }
  const name = typeof body.name === "string" && body.name.trim() ? body.name.trim().slice(0, 80) : "Mesa de RPG"
  const id = randomId(10)
  const masterToken = randomId(28)
  await sql.transaction([
    sql`INSERT INTO rooms (id, master_token, name) VALUES (${id}, ${masterToken}, ${name})`,
    sql`INSERT INTO layer_state (room_id, layer, label) VALUES (${id}, 1, 'Música')`,
    sql`INSERT INTO lists (room_id, layer, name, loop_default, position) VALUES (${id}, 1, 'Músicas', false, 0)`,
  ])
  return NextResponse.json({ roomId: id, masterToken })
}
