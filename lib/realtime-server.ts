import { createRealtime, rawSql } from "@neon/realtime/server"
import type { LayerState, PresenceRow } from "./types"

export const realtime = createRealtime({
  secret: process.env.NEON_REALTIME_SECRET!,
  db: "neondb",
})

// Players see only this: no track names, so nothing gets spoiled.
export function layerStateQuery(roomId: string) {
  return rawSql<LayerState>(
    `SELECT layer, track_id, youtube_id, start_seconds, started_at_ms, loop, volume,
       label, paused, paused_position, resume_with_all
     FROM layer_state WHERE room_id = $1 ORDER BY layer`,
    [roomId]
  )
}

export function presenceQuery(roomId: string) {
  return rawSql<PresenceRow>(
    `SELECT client_id, nickname, audio_ok, last_seen_ms FROM presence WHERE room_id = $1 ORDER BY nickname`,
    [roomId]
  )
}
