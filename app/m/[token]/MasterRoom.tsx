"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { CopyLink } from "@/components/CopyLink"
import { ThemeToggle } from "@/components/ThemeToggle"
import { clientId as getClientId } from "@/components/ids"
import { PlayerDock, useLayers } from "@/components/useLayers"
import { usePresence } from "@/components/usePresence"
import { serverNow, startClockSync } from "@/lib/clock"
import type { LayerPlayer } from "@/lib/layer-player"
import { useLiveRows } from "@/lib/live"
import { playlistVideoIds } from "@/lib/playlist"
import { load, save } from "@/lib/storage"
import { MAX_LAYERS, type LayerState, type List, type PresenceRow } from "@/lib/types"
import { ListCard } from "./ListCard"
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

  function setMyVolume(layer: number, value: number) {
    const next = { ...myVolumes, [layer]: value }
    setMyVolumes(next)
    save(`rpjams:volumes:${roomId}`, next)
  }

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
    <main className="page">
      <header className="card header">
        <div className="header-top">
          <div className="stack" style={{ gap: 2 }}>
            <h1>{roomName}</h1>
            <span className={`small ${connected ? "muted" : "error"}`}>{connected ? "Conectado" : "Conectando…"}</span>
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

      <div className="layers">
        {LAYERS.map((layer, index) => {
          const state = layerState(layer)
          const current = state?.track_id ? tracksById.get(state.track_id) : undefined
          const status = state?.youtube_id ? (state.paused ? "pausado" : engineStatus(layer)) : "silencio"
          const playing = isPlaying(layer)
          return (
            <section key={layer} className="card stack">
              <div className="layer-head">
                <LayerTitle number={index + 1} label={state?.label ?? ""} onRename={(label) => call("setLayerLabel", { layer, label })} />
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
                <button className={`round ${playing ? "" : "primary"}`} title={playing ? "Pausar esta camada" : "Tocar esta camada"} onClick={() => toggleLayer(layer)}>
                  {playing ? "⏸" : "▶"}
                </button>
              </div>
              <div className="now">
                <span className={`status ${status}`}>{STATUS_TEXT[status]}</span>
                <strong>{current ? current.title : state?.youtube_id ? "Faixa removida" : "Nada tocando"}</strong>
                {current && <span className="small muted">{current.listName}</span>}
                <div className="row">
                  <button className={state?.loop ? "on" : ""} disabled={!state} onClick={() => state && toggleLoop(state)}>
                    Loop {state?.loop ? "ligado" : "desligado"}
                  </button>
                </div>
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
              {lists
                .filter((list) => list.layer === layer)
                .map((list) => (
                  <ListCard
                    key={list.id}
                    list={list}
                    currentTrackId={state?.track_id ?? null}
                    playing={playing}
                    seekBar={<SeekBar getPlayer={getPlayers[layer]} onSeek={(position) => call("seek", { layer, position })} />}
                    call={call}
                    onImportPlaylist={importPlaylist}
                  />
                ))}
              <NewList onCreate={async (name) => !!(await call("createList", { layer, name }))} />
            </section>
          )
        })}
        {layerRows && LAYERS.length < MAX_LAYERS && <AddLayerCard first={LAYERS.length === 1} onAdd={() => call("addLayer")} />}
      </div>
      <PlayerDock hostRef={hostRef} />
    </main>
  )
}

function AddLayerCard({ first, onAdd }: { first: boolean; onAdd: () => void }) {
  return (
    <section className="card add-layer">
      <h2>Nova camada</h2>
      <button className="add-layer-button" onClick={onAdd} title="Criar nova camada">
        +
      </button>
      <p className="small muted">
        Uma camada toca ao mesmo tempo que as outras, com listas, volume e loop próprios.
        {first ? " A segunda camada já vem pronta para ambientes: chuva, taverna, floresta, masmorra." : " Útil para separar ambientes, trilhas de personagens ou um segundo clima."}
      </p>
    </section>
  )
}

function LayerTitle({ number, label, onRename }: { number: number; label: string; onRename: (label: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(label)
  const finish = () => {
    setEditing(false)
    if (draft.trim() && draft.trim() !== label) onRename(draft.trim())
  }
  return (
    <div className="row layer-title">
      <h2>Camada {number}</h2>
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
          <span className="tag">{label}</span>
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

function NewList({ onCreate }: { onCreate: (name: string) => Promise<boolean> }) {
  const [name, setName] = useState("")
  const [open, setOpen] = useState(false)
  if (!open) {
    return (
      <button className="ghost" onClick={() => setOpen(true)}>
        + Nova lista
      </button>
    )
  }
  const submit = async () => {
    if (name.trim() && (await onCreate(name))) {
      setName("")
      setOpen(false)
    }
  }
  return (
    <div className="row">
      <input type="text" autoFocus placeholder="Nome da lista" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
      <button className="primary" onClick={submit}>
        Criar
      </button>
      <button className="ghost" onClick={() => setOpen(false)}>
        Cancelar
      </button>
    </div>
  )
}
