"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { CopyLink } from "@/components/CopyLink"
import { LogoMark } from "@/components/Logo"
import { ThemeToggle } from "@/components/ThemeToggle"
import { clientId as getClientId } from "@/components/ids"
import { PlayerDock, useLayers } from "@/components/useLayers"
import { usePresence } from "@/components/usePresence"
import { serverNow, startClockSync } from "@/lib/clock"
import type { LayerPlayer } from "@/lib/layer-player"
import { useLiveRows } from "@/lib/live"
import { playlistVideoIds } from "@/lib/playlist"
import { parsePlaylistId } from "@/lib/youtube"
import { load, save } from "@/lib/storage"
import { MAX_LAYERS, type LayerState, type List, type PresenceRow } from "@/lib/types"
import { TrackPanel } from "./TrackPanel"
import { SeekBar } from "./SeekBar"

const STATUS_TEXT: Record<string, string> = {
  silencio: "Silêncio",
  carregando: "Carregando",
  aguardando: "Começando",
  tocando: "Tocando",
  pausado: "Pausado",
  terminou: "Terminou",
  erro: "Erro ao tocar",
}

export function MasterRoom({ token, roomId, roomName }: { token: string; roomId: string; roomName: string }) {
  const [joined, setJoined] = useState(false)
  const [lists, setLists] = useState<List[]>([])
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [origin, setOrigin] = useState("")
  const [clientId, setClientId] = useState("")
  const [myVolumes, setMyVolumes] = useState<Record<number, number>>({})
  const [now, setNow] = useState(0)

  const call = useCallback(
    async (action: string, data: object = {}) => {
      setError("")
      const res = await fetch("/api/master", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action, ...data }),
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string; lists?: List[]; added?: number; skipped?: number }
      if (!res.ok) {
        setError(body.error ?? "Algo deu errado")
        return false
      }
      if (body.lists) setLists(body.lists)
      return body
    },
    [token]
  )

  useEffect(() => {
    setOrigin(window.location.origin)
    setClientId(getClientId())
    setMyVolumes(load<Record<number, number>>(`rpjams:volumes:${roomId}`, {}))
    call("library")
    const timer = setInterval(() => setNow(Date.now()), 5000)
    setNow(Date.now())
    return () => clearInterval(timer)
  }, [call, roomId])

  const layerRequest = useMemo(() => (joined ? { masterToken: token } : null), [joined, token])
  const presenceRequest = useMemo(() => ({ masterToken: token, kind: "presence" }), [token])
  const { rows: layerRows, connected } = useLiveRows<LayerState>(layerRequest)
  const { rows: people } = useLiveRows<PresenceRow>(presenceRequest)
  const { hostRef, playersRef, statuses, statusKeys } = useLayers(joined, layerRows, myVolumes)
  const layerKey = (layerRows ?? []).map((s) => s.layer).sort((a, b) => a - b).join(",")
  const LAYERS = useMemo(() => (layerKey ? layerKey.split(",").map(Number) : []), [layerKey])
  usePresence(clientId ? { masterToken: token } : null, clientId, "Mestre", joined)

  const tracksById = useMemo(() => {
    const map = new Map<string, { title: string; listName: string }>()
    for (const list of lists) for (const track of list.tracks) map.set(track.id, { title: track.title, listName: list.name })
    return map
  }, [lists])

  const online = (people ?? []).filter((p) => now - p.last_seen_ms < 45_000 && p.client_id !== clientId)

  // When a track ends without loop, the master's page asks for the next one of the same list.
  useEffect(() => {
    for (const layer of LAYERS) {
      const state = layerRows?.find((s) => s.layer === layer)
      if ((statuses[layer] !== "terminou" && statuses[layer] !== "erro") || !state?.track_id || state.loop || state.paused) continue
      if (statusKeys[layer] !== `${state.track_id}:${state.youtube_id}`) continue
      call("next", { layer, fromTrackId: state.track_id, fromStartedAtMs: state.started_at_ms })
    }
  }, [LAYERS, statuses, statusKeys, layerRows, call])

  async function join() {
    await startClockSync()
    setJoined(true)
  }

  // Coming straight from creating the room, the browser already allows sound, so skip the
  // "Entrar como mestre" step. Opening the link later still shows it.
  useEffect(() => {
    const url = new URL(window.location.href)
    if (!url.searchParams.has("entrar")) return
    url.searchParams.delete("entrar")
    window.history.replaceState(null, "", url.pathname + url.search)
    const activation = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation
    if (activation?.hasBeenActive) join()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function setMyVolume(layer: number, value: number) {
    const next = { ...myVolumes, [layer]: value }
    setMyVolumes(next)
    save(`rpjams:volumes:${roomId}`, next)
  }

  // Layer cards may grow only down to the bottom of the screen, below the sticky header.
  const pageRef = useRef<HTMLElement>(null)
  const headerRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const header = headerRef.current
    const page = pageRef.current
    if (!header || !page) return
    const observer = new ResizeObserver(() => page.style.setProperty("--header-h", `${header.offsetHeight}px`))
    observer.observe(header)
    return () => observer.disconnect()
  }, [joined])

  // When a layer moves to another track, scroll its list so that track is first in view;
  // the ones already played stay above. The master can still scroll freely in between.
  const scrolledTo = useRef<Record<number, string | null>>({})
  useEffect(() => {
    for (const state of layerRows ?? []) {
      if (!state.track_id || scrolledTo.current[state.layer] === state.track_id) continue
      const card = pageRef.current?.querySelector(`[data-layer="${state.layer}"]`)
      const box = card?.querySelector<HTMLElement>(".layer-scroll")
      const track = card?.querySelector<HTMLElement>(".track.current")
      if (!box || !track) continue
      scrolledTo.current[state.layer] = state.track_id
      const top = track.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop
      box.scrollTo({ top: Math.max(0, top - 4), behavior: "smooth" })
    }
  }, [layerRows, lists])

  // Stable getters so the seek bars don't restart their timers on every render.
  const getPlayers = useMemo<Record<number, () => LayerPlayer | undefined>>(
    () => Object.fromEntries(LAYERS.map((l) => [l, () => playersRef.current[l]])),
    [LAYERS, playersRef]
  )

  function layerState(layer: number) {
    return layerRows?.find((s) => s.layer === layer)
  }

  /** What the local player says about the track the layer should be playing now. */
  function engineStatus(layer: number) {
    const state = layerState(layer)
    return statusKeys[layer] === `${state?.track_id}:${state?.youtube_id}` ? statuses[layer] : "carregando"
  }

  function isPlaying(layer: number) {
    const state = layerState(layer)
    const status = engineStatus(layer)
    return !!state?.youtube_id && !state.paused && status !== "terminou" && status !== "erro"
  }

  /** The list the layer play button starts: the one of the last track, else the first one. */
  function activeList(layer: number): List | undefined {
    const state = layerState(layer)
    const layerLists = lists.filter((l) => l.layer === layer)
    return layerLists.find((l) => l.tracks.some((t) => t.id === state?.track_id)) ?? layerLists.find((l) => l.tracks.length) ?? layerLists[0]
  }

  function positionOf(layer: number): number | undefined {
    return playersRef.current[layer]?.currentTime()
  }

  function pause(layers: number[], all: boolean) {
    const positions: Record<number, number> = {}
    for (const layer of layers) {
      const p = positionOf(layer)
      if (p !== undefined) positions[layer] = p
    }
    return call("pause", { layers, positions, all })
  }

  function startOrResume(layer: number) {
    const state = layerState(layer)
    if (state?.paused) return call("resume", { layers: [layer] })
    const list = activeList(layer)
    if (!list?.tracks.length) {
      setError(`Adicione uma faixa na camada ${state?.label || ""} primeiro`)
      return
    }
    return call("startList", { listId: list.id })
  }

  function toggleLayer(layer: number) {
    if (isPlaying(layer)) return pause([layer], false)
    return startOrResume(layer)
  }

  function playAll() {
    const pausedByAll = LAYERS.filter((l) => layerState(l)?.paused && layerState(l)?.resume_with_all)
    if (pausedByAll.length) return call("resume", { layers: pausedByAll })
    // Layers with nothing to play are skipped quietly.
    for (const layer of LAYERS) {
      if (isPlaying(layer)) continue
      if (layerState(layer)?.paused || activeList(layer)?.tracks.length) startOrResume(layer)
    }
  }

  function pauseAll() {
    const playing = LAYERS.filter(isPlaying)
    if (playing.length) pause(playing, true)
  }

  /** Adds every video of a YouTube playlist to a list, in the playlist's order. */
  async function importPlaylist(listId: string, playlistId: string) {
    if (!hostRef.current) return false
    setError("")
    setNotice("Lendo a playlist do YouTube…")
    try {
      const videoIds = await playlistVideoIds(playlistId, hostRef.current)
      setNotice(`Adicionando ${videoIds.length} vídeos…`)
      const result = await call("addTracks", { listId, videoIds })
      if (!result) {
        setNotice("")
        return false
      }
      const skipped = result.skipped ? ` (${result.skipped} não podem tocar fora do YouTube e ficaram de fora)` : ""
      setNotice(`${result.added} faixas adicionadas${skipped}.`)
      setTimeout(() => setNotice(""), 8000)
      return true
    } catch (e) {
      setNotice("")
      setError(e instanceof Error ? e.message : "Não consegui ler essa playlist")
      return false
    }
  }

  function toggleLoop(state: LayerState) {
    const loop = !state.loop
    // Keep everyone where they are: restate the start time from the current position.
    let startedAtMs: number | undefined
    if (!state.paused) {
      const current = positionOf(state.layer)
      if (engineStatus(state.layer) === "terminou") startedAtMs = serverNow()
      else if (current !== undefined && state.youtube_id) startedAtMs = serverNow() - (current - state.start_seconds) * 1000
    }
    call("setLoop", { layer: state.layer, loop, startedAtMs })
  }

  if (!joined) {
    return (
      <main className="center stack">
        <LogoMark corner />
        <div className="corner">
          <ThemeToggle />
        </div>
        <h1>{roomName}</h1>
        <div className="card stack">
          <p className="muted">Você é o mestre desta sala. Clique para liberar o som no seu navegador.</p>
          <button className="primary" onClick={join}>
            Entrar como mestre
          </button>
        </div>
      </main>
    )
  }

  const anyPlaying = LAYERS.some(isPlaying)

  return (
    <main className="page" ref={pageRef}>
      <header className="card header" ref={headerRef}>
        <div className="header-top">
          <div className="row" style={{ gap: 14 }}>
          <LogoMark />
          <div className="stack" style={{ gap: 2 }}>
            <h1>{roomName}</h1>
            <span className={`small ${connected ? "muted" : "error"}`}>{connected ? "Conectado" : "Conectando…"}</span>
          </div>
          </div>
          <div className="row">
            <button className="primary big" onClick={playAll}>
              ▶ Play geral
            </button>
            <button className="danger big" onClick={pauseAll} disabled={!anyPlaying}>
              ⏸ Pause geral
            </button>
            <ThemeToggle />
          </div>
        </div>
        <div className="header-bottom">
          <div className="row" style={{ flexWrap: "wrap" }}>
            <strong className="small">Na sala:</strong>
            <div className="people">
              {online.length === 0 && <span className="muted small">Ninguém ainda</span>}
              {online.map((p) => (
                <span key={p.client_id} className={`pill ${p.audio_ok ? "ok" : "warn"}`} title={p.audio_ok ? "Som ativo" : "Ainda não clicou em Entrar"}>
                  {p.nickname}
                  {p.audio_ok ? "" : " (sem som)"}
                </span>
              ))}
            </div>
          </div>
          <div className="row header-link">
            <span className="small muted">Link dos jogadores</span>
            <CopyLink url={`${origin}/s/${roomId}`} />
          </div>
        </div>
      </header>

      {error && <p className="error">{error}</p>}
      {notice && <p className="notice">{notice}</p>}

      <LayerGrid items={LAYERS.length + (layerRows && LAYERS.length < MAX_LAYERS ? 1 : 0)}>
        {LAYERS.map((layer, index) => {
          const state = layerState(layer)
          const current = state?.track_id ? tracksById.get(state.track_id) : undefined
          const status = state?.youtube_id ? (state.paused ? "pausado" : engineStatus(layer)) : "silencio"
          const playing = isPlaying(layer)
          const layerLists = lists.filter((list) => list.layer === layer)
          const empty = layerLists.every((list) => list.tracks.length === 0)
          return (
            <section key={layer} data-layer={layer} className={`card stack layer-card ${empty ? "empty-card" : ""}`}>
              <div className="layer-head">
                <LayerTitle label={state?.label || `Camada ${index + 1}`} onRename={(label) => call("setLayerLabel", { layer, label })} />
                {LAYERS.length > 1 && (
                  <button
                    className="ghost"
                    title="Apagar camada"
                    onClick={() =>
                      window.confirm(`Apagar a camada “${state?.label}” com todas as listas e faixas dela?`) && call("deleteLayer", { layer })
                    }
                  >
                    🗑
                  </button>
                )}
                {!empty && (
                  <button className={`round ${playing ? "" : "primary"}`} title={playing ? "Pausar esta camada" : "Tocar esta camada"} onClick={() => toggleLayer(layer)}>
                    {playing ? "⏸" : "▶"}
                  </button>
                )}
              </div>
              {empty ? (
                <EmptyLayer
                  onAdd={async (url) => {
                    // Use the layer's first list, creating one named after the layer if it has none.
                    let listId: string | undefined = layerLists[0]?.id
                    if (!listId) {
                      const created = await call("createList", { layer, name: state?.label || "Lista" })
                      listId = created ? created.lists?.find((l) => l.layer === layer)?.id : undefined
                      if (!listId) return false
                    }
                    const playlistId = parsePlaylistId(url)
                    const target = listId
                    return playlistId ? importPlaylist(target, playlistId) : !!(await call("addTrack", { listId: target, url }))
                  }}
                />
              ) : (
              <>
              <div className="now">
                {/* Status and loop share the first row, so the track title gets the full width below. */}
                <div className="now-top">
                  <span className={`status ${status}`}>{STATUS_TEXT[status]}</span>
                  <button className={`loop-btn ${state?.loop ? "on" : ""}`} disabled={!state} onClick={() => state && toggleLoop(state)}>
                    Loop {state?.loop ? "ligado" : "desligado"}
                  </button>
                </div>
                <strong>{current ? current.title : state?.youtube_id ? "Faixa removida" : "Nada tocando"}</strong>
                <label className="stack small" style={{ gap: 2 }}>
                  <span className="muted">Volume para todos: {state?.volume ?? 80}%</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    defaultValue={state?.volume ?? 80}
                    key={`v${layer}-${state ? "ready" : "loading"}`}
                    onPointerUp={(e) => call("setVolume", { layer, volume: Number(e.currentTarget.value) })}
                    onKeyUp={(e) => call("setVolume", { layer, volume: Number(e.currentTarget.value) })}
                  />
                </label>
                <label className="stack small" style={{ gap: 2 }}>
                  <span className="muted">Só no seu computador: {myVolumes[layer] ?? 100}%</span>
                  <input type="range" min={0} max={100} value={myVolumes[layer] ?? 100} onChange={(e) => setMyVolume(layer, Number(e.target.value))} />
                </label>
              </div>
              {layerLists[0] && (
                <TrackPanel
                  layer={layer}
                  listId={layerLists[0].id}
                  tracks={layerLists.flatMap((list) => list.tracks)}
                  currentTrackId={state?.track_id ?? null}
                  playing={playing}
                  seekBar={<SeekBar getPlayer={getPlayers[layer]} onSeek={(position) => call("seek", { layer, position })} />}
                  call={call}
                  onImportPlaylist={importPlaylist}
                />
              )}
              </>
              )}
            </section>
          )
        })}
        {layerRows && LAYERS.length < MAX_LAYERS && <AddLayerCard onAdd={async (label) => !!(await call("addLayer", { label }))} />}
      </LayerGrid>
      <PlayerDock hostRef={hostRef} />
    </main>
  )
}

const CARD_MIN_WIDTH = 330

/**
 * Lays the layer cards out without leaving one alone on a row: everything in one row when
 * it fits, otherwise two per row, and one per row on narrow screens.
 */
function LayerGrid({ items, children }: { items: number; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  const gap = 16
  const fits = (cols: number) => cols * CARD_MIN_WIDTH + (cols - 1) * gap <= width
  const columns = !width ? Math.min(items, 2) : fits(items) ? items : fits(2) ? 2 : 1
  return (
    <div ref={ref} className="layers" style={{ gridTemplateColumns: `repeat(${Math.max(columns, 1)}, minmax(0, 1fr))` }}>
      {children}
    </div>
  )
}

function AddLayerCard({ onAdd }: { onAdd: (label: string) => Promise<boolean> }) {
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState("")
  const submit = async () => {
    if (!name.trim()) return
    if (await onAdd(name.trim())) {
      setName("")
      setNaming(false)
    }
  }
  return (
    <section className="card add-layer">
      <h2>Nova camada</h2>
      {naming ? (
        <div className="stack" style={{ width: "100%", maxWidth: 280 }}>
          <input
            type="text"
            autoFocus
            maxLength={30}
            placeholder="Nome da camada (ex.: Ambiente)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit()
              if (e.key === "Escape") setNaming(false)
            }}
          />
          <div className="row" style={{ justifyContent: "center" }}>
            <button className="primary" onClick={submit} disabled={!name.trim()}>
              Criar camada
            </button>
            <button className="ghost" onClick={() => setNaming(false)}>
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button className="add-layer-button" onClick={() => setNaming(true)} title="Criar nova camada">
          +
        </button>
      )}
      <p className="small muted">
        Uma nova camada toca ao mesmo tempo que as outras, com listas, volume e loop próprios. Útil para separar ambientes, trilhas
        de personagens ou um segundo clima.
      </p>
    </section>
  )
}

function EmptyLayer({ onAdd }: { onAdd: (url: string) => Promise<boolean> }) {
  const [url, setUrl] = useState("")
  const [busy, setBusy] = useState(false)
  const add = async () => {
    if (!url.trim()) return
    setBusy(true)
    if (await onAdd(url.trim())) setUrl("")
    setBusy(false)
  }
  return (
    <div className="empty-layer stack">
      <p className="muted">Cole o link de um vídeo ou de uma playlist do YouTube para começar.</p>
      <div className="row">
        <input type="url" placeholder="Colar link do YouTube" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
        <button className="primary" onClick={add} disabled={busy}>
          {busy ? "…" : "Adicionar"}
        </button>
      </div>
    </div>
  )
}

function LayerTitle({ label, onRename }: { label: string; onRename: (label: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(label)
  const finish = () => {
    setEditing(false)
    if (draft.trim() && draft.trim() !== label) onRename(draft.trim())
  }
  return (
    <div className="row layer-title">
      {editing ? (
        <input
          type="text"
          autoFocus
          maxLength={30}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={finish}
          onKeyDown={(e) => {
            if (e.key === "Enter") finish()
            if (e.key === "Escape") setEditing(false)
          }}
        />
      ) : (
        <>
          <h2 className="layer-name">{label}</h2>
          <button
            className="ghost"
            title="Renomear camada"
            onClick={() => {
              setDraft(label)
              setEditing(true)
            }}
          >
            ✎
          </button>
        </>
      )}
    </div>
  )
}
