import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL)

const statements = [
  `CREATE TABLE IF NOT EXISTS rooms (
    id text PRIMARY KEY,
    master_token text NOT NULL UNIQUE,
    name text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS lists (
    id bigserial PRIMARY KEY,
    room_id text NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    layer smallint NOT NULL CHECK (layer IN (1, 2)),
    name text NOT NULL,
    loop_default boolean NOT NULL,
    position integer NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS tracks (
    id bigserial PRIMARY KEY,
    list_id bigint NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
    room_id text NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    youtube_id text NOT NULL,
    start_seconds integer NOT NULL DEFAULT 0,
    title text NOT NULL,
    position integer NOT NULL DEFAULT 0
  )`,
  // What each layer is playing. Players subscribe to this table, so it holds no track names.
  `CREATE TABLE IF NOT EXISTS layer_state (
    room_id text NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    layer smallint NOT NULL CHECK (layer IN (1, 2)),
    track_id bigint,
    youtube_id text,
    start_seconds integer NOT NULL DEFAULT 0,
    started_at_ms double precision NOT NULL DEFAULT 0,
    loop boolean NOT NULL DEFAULT false,
    volume integer NOT NULL DEFAULT 80,
    PRIMARY KEY (room_id, layer)
  )`,
  `CREATE TABLE IF NOT EXISTS presence (
    room_id text NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    client_id text NOT NULL,
    nickname text NOT NULL,
    audio_ok boolean NOT NULL DEFAULT false,
    last_seen_ms double precision NOT NULL,
    PRIMARY KEY (room_id, client_id)
  )`,
  `ALTER TABLE layer_state ADD COLUMN IF NOT EXISTS label text NOT NULL DEFAULT ''`,
  `ALTER TABLE layer_state ADD COLUMN IF NOT EXISTS paused boolean NOT NULL DEFAULT false`,
  `ALTER TABLE layer_state ADD COLUMN IF NOT EXISTS paused_position double precision NOT NULL DEFAULT 0`,
  // True when "Pause geral" paused this layer, so "Play geral" brings back only those.
  `ALTER TABLE layer_state ADD COLUMN IF NOT EXISTS resume_with_all boolean NOT NULL DEFAULT false`,
  `UPDATE layer_state SET label = CASE layer WHEN 1 THEN 'Música' ELSE 'Ambiente' END WHERE label = ''`,
  `CREATE INDEX IF NOT EXISTS lists_room_idx ON lists(room_id)`,
  `CREATE INDEX IF NOT EXISTS tracks_list_idx ON tracks(list_id)`,
]

for (const statement of statements) {
  await sql.query(statement)
}
console.log("Tabelas prontas.")
