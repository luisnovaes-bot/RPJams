import { NextResponse } from "next/server"
import { roomByMasterToken, sql } from "@/lib/db"
import { MAX_LAYERS, type List, type Track } from "@/lib/types"
import { VIDEO_ID, fetchYouTubeTitle, parseYouTubeUrl } from "@/lib/youtube"

// The old track fades out during this lead, then the new one starts from its beginning for everyone.
const START_LEAD_MS = 1500
const RESUME_LEAD_MS = 400

async function playTrack(roomId: string, trackId: string): Promise<boolean> {
  const rows = (await sql`
    SELECT t.id::text, t.youtube_id, t.start_seconds, l.layer, l.loop_default
    FROM tracks t JOIN lists l ON l.id = t.list_id
    WHERE t.id = ${trackId} AND t.room_id = ${roomId}`) as {
    id: string
    youtube_id: string
    start_seconds: number
    layer: number
    loop_default: boolean
  }[]
  const track = rows[0]
  if (!track) return false
  await sql`
    UPDATE layer_state SET track_id = ${track.id}, youtube_id = ${track.youtube_id},
      start_seconds = ${track.start_seconds}, started_at_ms = ${Date.now() + START_LEAD_MS},
      loop = ${track.loop_default}, paused = false, resume_with_all = false
    WHERE room_id = ${roomId} AND layer = ${track.layer}`
  return true
}

type Body = Record<string, unknown>

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

function asId(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isInteger(value)) return String(value)
  if (typeof value === "string" && /^\d{1,18}$/.test(value)) return value
  return undefined
}

function asLayer(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= MAX_LAYERS ? value : undefined
}

function asText(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined
  const text = value.trim()
  return text ? text.slice(0, max) : undefined
}

async function library(roomId: string) {
  const lists = (await sql`
    SELECT id::text, layer, name, loop_default, position FROM lists
    WHERE room_id = ${roomId} ORDER BY layer, position, id`) as Omit<List, "tracks">[]
  const tracks = (await sql`
    SELECT id::text, list_id::text, youtube_id, start_seconds, title, position FROM tracks
    WHERE room_id = ${roomId} ORDER BY position, id`) as Track[]
  return lists.map((list) => ({ ...list, tracks: tracks.filter((t) => t.list_id === list.id) }))
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Body
  const room = typeof body.token === "string" ? await roomByMasterToken(body.token) : undefined
  if (!room) return fail("Link de mestre inválido", 403)
  const roomId = room.id

  switch (body.action) {
    case "library":
      return NextResponse.json({ room: { id: room.id, name: room.name }, lists: await library(roomId) })

    case "createList": {
      const layer = asLayer(body.layer)
      const name = asText(body.name, 60)
      if (!layer || !name) return fail("Dê um nome para a lista")
      await sql`
        INSERT INTO lists (room_id, layer, name, loop_default, position)
        VALUES (${roomId}, ${layer}, ${name}, ${layer !== 1},
          (SELECT coalesce(max(position) + 1, 0) FROM lists WHERE room_id = ${roomId} AND layer = ${layer}))`
      break
    }

    case "renameList": {
      const listId = asId(body.listId)
      const name = asText(body.name, 60)
      if (!listId || !name) return fail("Nome inválido")
      await sql`UPDATE lists SET name = ${name} WHERE id = ${listId} AND room_id = ${roomId}`
      break
    }

    case "setListLoop": {
      const listId = asId(body.listId)
      if (!listId || typeof body.loop !== "boolean") return fail("Pedido inválido")
      await sql`UPDATE lists SET loop_default = ${body.loop} WHERE id = ${listId} AND room_id = ${roomId}`
      break
    }

    case "deleteList": {
      const listId = asId(body.listId)
      if (!listId) return fail("Pedido inválido")
      await sql`DELETE FROM lists WHERE id = ${listId} AND room_id = ${roomId}`
      break
    }

    case "addTrack": {
      const listId = asId(body.listId)
      const parsed = typeof body.url === "string" ? parseYouTubeUrl(body.url) : undefined
      if (!listId) return fail("Pedido inválido")
      if (!parsed) return fail("Esse não parece um link de vídeo do YouTube")
      const owned = await sql`SELECT 1 FROM lists WHERE id = ${listId} AND room_id = ${roomId}`
      if (!owned.length) return fail("Lista não encontrada", 404)
      const title = await fetchYouTubeTitle(parsed.youtubeId)
      if (!title) return fail("Esse vídeo não pode tocar fora do YouTube (é privado ou o dono bloqueou)")
      await sql`
        INSERT INTO tracks (list_id, room_id, youtube_id, start_seconds, title, position)
        VALUES (${listId}, ${roomId}, ${parsed.youtubeId}, ${parsed.startSeconds}, ${title.slice(0, 120)},
          (SELECT coalesce(max(position) + 1, 0) FROM tracks WHERE list_id = ${listId}))`
      break
    }

    case "addTracks": {
      // A whole playlist, already in order. Videos that can't play outside YouTube are skipped.
      const listId = asId(body.listId)
      const ids = Array.isArray(body.videoIds) ? body.videoIds.filter((v): v is string => typeof v === "string" && VIDEO_ID.test(v)) : []
      if (!listId || ids.length === 0) return fail("Playlist vazia")
      if (ids.length > 200) return fail("A playlist tem mais de 200 vídeos; o limite é 200")
      const owned = await sql`SELECT 1 FROM lists WHERE id = ${listId} AND room_id = ${roomId}`
      if (!owned.length) return fail("Lista não encontrada", 404)
      const titles: (string | undefined)[] = new Array(ids.length)
      for (let i = 0; i < ids.length; i += 10) {
        const batch = await Promise.all(ids.slice(i, i + 10).map((id) => fetchYouTubeTitle(id).catch(() => undefined)))
        batch.forEach((title, j) => (titles[i + j] = title))
      }
      const rows = ids.map((id, i) => ({ id, title: titles[i] })).filter((r): r is { id: string; title: string } => !!r.title)
      const base = (await sql`SELECT coalesce(max(position) + 1, 0)::int AS p FROM tracks WHERE list_id = ${listId}`) as { p: number }[]
      if (rows.length) {
        await sql.transaction(
          rows.map((row, i) => sql`
            INSERT INTO tracks (list_id, room_id, youtube_id, start_seconds, title, position)
            VALUES (${listId}, ${roomId}, ${row.id}, 0, ${row.title.slice(0, 120)}, ${base[0].p + i})`)
        )
      }
      return NextResponse.json({ lists: await library(roomId), added: rows.length, skipped: ids.length - rows.length })
    }

    case "renameTrack": {
      const trackId = asId(body.trackId)
      const title = asText(body.title, 120)
      if (!trackId || !title) return fail("Nome inválido")
      await sql`UPDATE tracks SET title = ${title} WHERE id = ${trackId} AND room_id = ${roomId}`
      break
    }

    case "deleteTrack": {
      const trackId = asId(body.trackId)
      if (!trackId) return fail("Pedido inválido")
      await sql`DELETE FROM tracks WHERE id = ${trackId} AND room_id = ${roomId}`
      break
    }

    case "reorderTracks": {
      const listId = asId(body.listId)
      const ids = Array.isArray(body.trackIds) ? body.trackIds.map(asId) : []
      if (!listId || ids.some((id) => !id)) return fail("Pedido inválido")
      await sql.transaction(
        ids.map((id, index) => sql`
          UPDATE tracks SET position = ${index}
          WHERE id = ${id!} AND list_id = ${listId} AND room_id = ${roomId}`)
      )
      break
    }

    case "play": {
      const trackId = asId(body.trackId)
      if (!trackId) return fail("Pedido inválido")
      if (!(await playTrack(roomId, trackId))) return fail("Faixa não encontrada", 404)
      return NextResponse.json({ ok: true })
    }

    case "startList": {
      const listId = asId(body.listId)
      if (!listId) return fail("Pedido inválido")
      const first = (await sql`
        SELECT id::text FROM tracks WHERE list_id = ${listId} AND room_id = ${roomId}
        ORDER BY position, id LIMIT 1`) as { id: string }[]
      if (!first[0]) return fail("Essa lista ainda não tem faixas")
      await playTrack(roomId, first[0].id)
      return NextResponse.json({ ok: true })
    }

    case "next": {
      // Sent by the master's page when a track ends: plays the next one of the same list.
      const layer = asLayer(body.layer)
      const fromTrackId = asId(body.fromTrackId)
      const fromStartedAt = typeof body.fromStartedAtMs === "number" ? body.fromStartedAtMs : undefined
      if (!layer || !fromTrackId || fromStartedAt === undefined) return fail("Pedido inválido")
      const next = (await sql`
        SELECT n.id::text FROM layer_state s
        JOIN tracks cur ON cur.id = s.track_id
        JOIN tracks n ON n.list_id = cur.list_id AND (n.position, n.id) > (cur.position, cur.id)
        WHERE s.room_id = ${roomId} AND s.layer = ${layer} AND s.track_id = ${fromTrackId}
          AND s.started_at_ms = ${fromStartedAt} AND NOT s.paused AND NOT s.loop
        ORDER BY n.position, n.id LIMIT 1`) as { id: string }[]
      if (next[0]) await playTrack(roomId, next[0].id)
      return NextResponse.json({ ok: true })
    }

    case "pause": {
      // positions: where the master's player is, so everyone resumes from the same spot.
      const layers = Array.isArray(body.layers) ? body.layers.map(asLayer).filter(Boolean) : []
      const positions = (body.positions ?? {}) as Record<string, unknown>
      const all = body.all === true
      for (const layer of layers) {
        const position = typeof positions[String(layer)] === "number" ? (positions[String(layer)] as number) : null
        await sql`
          UPDATE layer_state SET paused = true, resume_with_all = ${all},
            paused_position = coalesce(${position}::double precision,
              start_seconds + greatest(0, (${Date.now()}::double precision - started_at_ms) / 1000))
          WHERE room_id = ${roomId} AND layer = ${layer!} AND youtube_id IS NOT NULL AND NOT paused`
      }
      return NextResponse.json({ ok: true })
    }

    case "resume": {
      const layers = Array.isArray(body.layers) ? body.layers.map(asLayer).filter(Boolean) : []
      for (const layer of layers) {
        await sql`
          UPDATE layer_state SET paused = false, resume_with_all = false,
            started_at_ms = ${Date.now() + RESUME_LEAD_MS}::double precision - (paused_position - start_seconds) * 1000
          WHERE room_id = ${roomId} AND layer = ${layer!} AND paused`
      }
      return NextResponse.json({ ok: true })
    }

    case "seek": {
      // Moves the layer to a point of the track. Seeking before the track's start also moves
      // where the loop restarts, for this play only.
      const layer = asLayer(body.layer)
      const position = typeof body.position === "number" && Number.isFinite(body.position) ? Math.max(0, body.position) : undefined
      if (!layer || position === undefined) return fail("Pedido inválido")
      await sql`
        UPDATE layer_state SET
          start_seconds = least(start_seconds, ${Math.floor(position)}),
          paused_position = ${position},
          started_at_ms = CASE WHEN paused THEN started_at_ms
            ELSE ${Date.now() + RESUME_LEAD_MS}::double precision - (${position}::double precision - least(start_seconds, ${Math.floor(position)})) * 1000 END
        WHERE room_id = ${roomId} AND layer = ${layer} AND youtube_id IS NOT NULL`
      return NextResponse.json({ ok: true })
    }

    case "addLayer": {
      // Takes the first free number. Layers after the first usually hold ambience, so loop starts on.
      const used = (await sql`SELECT layer FROM layer_state WHERE room_id = ${roomId}`) as { layer: number }[]
      const free = Array.from({ length: MAX_LAYERS }, (_, i) => i + 1).find((n) => !used.some((u) => u.layer === n))
      if (!free) return fail(`O limite é de ${MAX_LAYERS} camadas por sala`)
      const label = asText(body.label, 30) ?? (used.length === 1 ? "Ambiente" : "Nova camada")
      const listName = label === "Ambiente" ? "Ambientes" : "Lista 1"
      await sql.transaction([
        sql`INSERT INTO layer_state (room_id, layer, label) VALUES (${roomId}, ${free}, ${label})`,
        sql`INSERT INTO lists (room_id, layer, name, loop_default, position) VALUES (${roomId}, ${free}, ${listName}, true, 0)`,
      ])
      break
    }

    case "deleteLayer": {
      const layer = asLayer(body.layer)
      if (!layer) return fail("Pedido inválido")
      const count = (await sql`SELECT count(*)::int AS n FROM layer_state WHERE room_id = ${roomId}`) as { n: number }[]
      if (count[0].n <= 1) return fail("A sala precisa de pelo menos uma camada")
      await sql.transaction([
        sql`DELETE FROM layer_state WHERE room_id = ${roomId} AND layer = ${layer}`,
        sql`DELETE FROM lists WHERE room_id = ${roomId} AND layer = ${layer}`,
      ])
      break
    }

    case "setLayerLabel": {
      const layer = asLayer(body.layer)
      const label = asText(body.label, 30)
      if (!layer || !label) return fail("Nome inválido")
      await sql`UPDATE layer_state SET label = ${label} WHERE room_id = ${roomId} AND layer = ${layer}`
      return NextResponse.json({ ok: true })
    }

    case "setLoop": {
      const layer = asLayer(body.layer)
      if (!layer || typeof body.loop !== "boolean") return fail("Pedido inválido")
      // The master's page sends a new start time so turning loop off doesn't jump the position.
      const startedAt = typeof body.startedAtMs === "number" && Number.isFinite(body.startedAtMs) ? body.startedAtMs : null
      await sql`
        UPDATE layer_state SET loop = ${body.loop}, started_at_ms = coalesce(${startedAt}::double precision, started_at_ms)
        WHERE room_id = ${roomId} AND layer = ${layer}`
      return NextResponse.json({ ok: true })
    }

    case "setVolume": {
      const layer = asLayer(body.layer)
      const volume = typeof body.volume === "number" ? Math.round(Math.min(100, Math.max(0, body.volume))) : undefined
      if (!layer || volume === undefined) return fail("Pedido inválido")
      await sql`UPDATE layer_state SET volume = ${volume} WHERE room_id = ${roomId} AND layer = ${layer}`
      return NextResponse.json({ ok: true })
    }

    default:
      return fail("Ação desconhecida")
  }

  return NextResponse.json({ lists: await library(roomId) })
}
