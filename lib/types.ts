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
