import { neon } from "@neondatabase/serverless"

export const sql = neon(process.env.DATABASE_URL!)

export type Room = { id: string; master_token: string; name: string }

export async function roomByMasterToken(token: string): Promise<Room | undefined> {
  if (!token || token.length > 64) return undefined
  const rows = (await sql`SELECT id, master_token, name FROM rooms WHERE master_token = ${token}`) as Room[]
  return rows[0]
}

export async function roomById(id: string): Promise<Room | undefined> {
  if (!id || id.length > 64) return undefined
  const rows = (await sql`SELECT id, master_token, name FROM rooms WHERE id = ${id}`) as Room[]
  return rows[0]
}
