"use client"

import { useEffect, useMemo, useState } from "react"
import { clientId as getClientId } from "@/components/ids"
import { ThemeToggle } from "@/components/ThemeToggle"
import { LAYERS, PlayerDock, useLayers } from "@/components/useLayers"
import { usePresence } from "@/components/usePresence"
import { startClockSync } from "@/lib/clock"
import { useLiveRows } from "@/lib/live"
import { load, save } from "@/lib/storage"
import type { LayerState } from "@/lib/types"

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
  const [volumes, setVolumes] = useState<Record<number, number>>({ 1: 100, 2: 100 })

  useEffect(() => {
    setNickname(load("rpjams:nickname", ""))
    setVolumes(load(`rpjams:volumes:${roomId}`, { 1: 100, 2: 100 }))
    setClientId(getClientId())
  }, [roomId])

  const request = useMemo(() => (joined ? { roomId } : null), [joined, roomId])
  const { rows, connected } = useLiveRows<LayerState>(request)
  const { hostRef, statuses } = useLayers(joined, rows, volumes)
  usePresence(clientId ? { roomId } : null, clientId, nickname || "Sem nome", joined)

  async function join() {
    save("rpjams:nickname", nickname)
    await startClockSync()
    setJoined(true)
  }

  function setVolume(layer: number, value: number) {
    const next = { ...volumes, [layer]: value }
    setVolumes(next)
    save(`rpjams:volumes:${roomId}`, next)
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
      {LAYERS.map((layer) => {
        const state = rows?.find((r) => r.layer === layer)
        const status = state?.youtube_id ? (state.paused ? "pausado" : statuses[layer]) : "silencio"
        return (
          <div key={layer} className="card stack">
            <div className="row">
              <h2 style={{ flex: 1 }}>
                Camada {layer} {state?.label && <span className="tag">{state.label}</span>}
              </h2>
              <span className={`status ${status}`}>{STATUS_TEXT[status]}</span>
            </div>
            <label className="stack small">
              <span className="muted">Seu volume: {volumes[layer]}%</span>
              <input type="range" min={0} max={100} value={volumes[layer]} onChange={(e) => setVolume(layer, Number(e.target.value))} />
            </label>
          </div>
        )
      })}
      <PlayerDock hostRef={hostRef} />
    </main>
  )
}
