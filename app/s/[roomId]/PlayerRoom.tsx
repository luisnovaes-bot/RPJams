"use client"

import { useEffect, useMemo, useState } from "react"
import { clientId as getClientId } from "@/components/ids"
import { ThemeToggle } from "@/components/ThemeToggle"
import { PlayerDock, useLayers } from "@/components/useLayers"
import { usePresence } from "@/components/usePresence"
import { startClockSync } from "@/lib/clock"
import { useLiveRows } from "@/lib/live"
import { load, save } from "@/lib/storage"
import { MAX_LAYERS, type LayerState } from "@/lib/types"

const STATUS_TEXT: Record<string, string> = {
  silencio: "Em silêncio",
  carregando: "Carregando",
  aguardando: "Começando",
  tocando: "Tocando",
  pausado: "Pausado",
  terminou: "Em silêncio",
  erro: "Não foi possível tocar",
}

export function PlayerRoom({ roomId, roomName }: { roomId: string; roomName: string }) {
  const [nickname, setNickname] = useState("")
  const [joined, setJoined] = useState(false)
  const [clientId, setClientId] = useState("")
  const [volume, setVolumeState] = useState(100)

  useEffect(() => {
    setNickname(load("rpjams:nickname", ""))
    setVolumeState(load(`rpjams:volume:${roomId}`, 100))
    setClientId(getClientId())
  }, [roomId])

  const request = useMemo(() => (joined ? { roomId } : null), [joined, roomId])
  const { rows, connected } = useLiveRows<LayerState>(request)
  // One volume for this person, applied to both layers on top of the master's mix.
  const volumes = useMemo(() => Object.fromEntries(Array.from({ length: MAX_LAYERS }, (_, i) => [i + 1, volume])), [volume])
  const { hostRef, statuses } = useLayers(joined, rows, volumes)
  usePresence(clientId ? { roomId } : null, clientId, nickname || "Sem nome", joined)

  async function join() {
    save("rpjams:nickname", nickname)
    await startClockSync()
    setJoined(true)
  }

  function setVolume(value: number) {
    setVolumeState(value)
    save(`rpjams:volume:${roomId}`, value)
  }

  if (!joined) {
    return (
      <main className="center stack">
        <div className="corner">
          <ThemeToggle />
        </div>
        <h1>{roomName}</h1>
        <div className="card stack">
          <p className="muted">Digite seu nome e clique para entrar. O navegador só libera o som depois desse clique.</p>
          <input
            type="text"
            placeholder="Seu nome ou do personagem"
            value={nickname}
            maxLength={40}
            onChange={(e) => setNickname(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && join()}
          />
          <button className="primary" onClick={join}>
            Entrar na sessão
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="center stack">
      <div className="corner">
        <ThemeToggle />
      </div>
      <div className="topbar">
        <h1>{roomName}</h1>
        <span className={`pill ${connected ? "ok" : "warn"}`}>{connected ? "Conectado" : "Conectando…"}</span>
      </div>
      <p className="muted small">Pode trocar de aba ou minimizar: o som continua. Só não feche esta aba.</p>
      <div className="card stack">
        <label className="stack small">
          <span className="muted">Seu volume: {volume}%</span>
          <input type="range" min={0} max={100} value={volume} onChange={(e) => setVolume(Number(e.target.value))} />
        </label>
        {[...(rows ?? [])].sort((a, b) => a.layer - b.layer).map((state, index) => {
          const layer = state.layer
          const status = state?.youtube_id ? (state.paused ? "pausado" : statuses[layer]) : "silencio"
          return (
            <div key={layer} className="row player-layer">
              <span style={{ flex: 1 }}>
                <strong>{state.label || `Camada ${index + 1}`}</strong>
              </span>
              <span className={`status ${status}`}>{STATUS_TEXT[status]}</span>
            </div>
          )
        })}
      </div>
      <PlayerDock hostRef={hostRef} />
    </main>
  )
}
