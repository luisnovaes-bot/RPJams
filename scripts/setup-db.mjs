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
  // Rooms can have from 1 to 4 layers.
  `ALTER TABLE lists DROP CONSTRAINT IF EXISTS lists_layer_check`,
  `ALTER TABLE layer_state DROP CONSTRAINT IF EXISTS layer_state_layer_check`,
  `ALTER TABLE lists ADD CONSTRAINT lists_layer_check CHECK (layer BETWEEN 1 AND 4) NOT VALID`,
  `ALTER TABLE layer_state ADD CONSTRAINT layer_state_layer_check CHECK (layer BETWEEN 1 AND 4) NOT VALID`,
  // Each layer now has a single track list: fold any extra lists into the first one, keeping order.
  `UPDATE tracks t SET list_id = x.keep_id, position = x.rn - 1
   FROM (
     SELECT t2.id, k.keep_id,
       row_number() OVER (PARTITION BY k.keep_id ORDER BY l2.position, l2.id, t2.position, t2.id) AS rn
     FROM tracks t2
     JOIN lists l2 ON l2.id = t2.list_id
     JOIN (SELECT room_id, layer, min(id) AS keep_id FROM lists GROUP BY room_id, layer) k
       ON k.room_id = l2.room_id AND k.layer = l2.layer
   ) x
   WHERE t.id = x.id`,
  `DELETE FROM lists l USING (SELECT room_id, layer, min(id) AS keep_id FROM lists GROUP BY room_id, layer) k
   WHERE l.room_id = k.room_id AND l.layer = k.layer AND l.id <> k.keep_id`,
  `CREATE INDEX IF NOT EXISTS lists_room_idx ON lists(room_id)`,
  `CREATE INDEX IF NOT EXISTS tracks_list_idx ON tracks(list_id)`,
]

for (const statement of statements) {
  await sql.query(statement)
}
console.log("Tabelas prontas.")
