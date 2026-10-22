/** A room has from 1 to this many layers (each one is a 200x200 player on players' screens). */
export const MAX_LAYERS = 4

export type LayerState = {
  layer: number
  track_id: string | null
  youtube_id: string | null
  start_seconds: number
  started_at_ms: number
  loop: boolean
  volume: number
  label: string
  paused: boolean
  paused_position: number
  resume_with_all: boolean
}

export type PresenceRow = {
  client_id: string
  nickname: string
  audio_ok: boolean
  last_seen_ms: number
}

export type Track = {
  id: string
  list_id: string
  youtube_id: string
  start_seconds: number
  title: string
  position: number
}

export type List = {
  id: string
  layer: number
  name: string
  loop_default: boolean
  position: number
  tracks: Track[]
}

export type AdminRoom = {
  id: string
  name: string
  master_token: string
  created_at: string
  lists: number
  tracks: number
  layers: { layer: number; label: string; title: string | null; paused: boolean }[]
  people: { nickname: string; audio_ok: boolean; is_master: boolean }[]
}
