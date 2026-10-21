"use client"

import { useEffect, useRef, useState } from "react"
import { LayerPlayer, type LayerStatus } from "@/lib/layer-player"
import type { LayerState } from "@/lib/types"

export const LAYERS = [1, 2] as const

/** Runs both layer players once audio is unlocked, fed by the live layer state. */
export function useLayers(enabled: boolean, states: LayerState[] | undefined, localVolumes: Record<number, number>) {
  const hostRef = useRef<HTMLDivElement>(null)
  const playersRef = useRef<Record<number, LayerPlayer>>({})
  const [statuses, setStatuses] = useState<Record<number, LayerStatus>>({ 1: "silencio", 2: "silencio" })
  const [statusKeys, setStatusKeys] = useState<Record<number, string | null>>({ 1: null, 2: null })

  useEffect(() => {
    if (!enabled || !hostRef.current) return
    const host = hostRef.current
    const players: Record<number, LayerPlayer> = {}
    for (const layer of LAYERS) {
      const frame = document.createElement("div")
      frame.className = "player-frame"
      const slot = document.createElement("div")
      frame.appendChild(slot)
      host.appendChild(frame)
      players[layer] = new LayerPlayer(slot, (status, key) => {
        setStatuses((s) => ({ ...s, [layer]: status }))
        setStatusKeys((s) => ({ ...s, [layer]: key }))
      })
    }
    playersRef.current = players
    // Handy for checking sync from the browser console.
    ;(window as unknown as { rpjams: unknown }).rpjams = players
    return () => {
      Object.values(players).forEach((p) => p.destroy())
      host.replaceChildren()
      playersRef.current = {}
    }
  }, [enabled])

  useEffect(() => {
    for (const layer of LAYERS) {
      playersRef.current[layer]?.setDesired(states?.find((s) => s.layer === layer) ?? null)
    }
  }, [states, enabled])

  useEffect(() => {
    for (const layer of LAYERS) playersRef.current[layer]?.setLocalVolume(localVolumes[layer] ?? 100)
  }, [localVolumes, enabled])

  return { hostRef, playersRef, statuses, statusKeys }
}

/** The YouTube players. YouTube's terms ask for at least 200x200 and visible, so they sit in a corner. */
export function PlayerDock({ hostRef }: { hostRef: React.RefObject<HTMLDivElement | null> }) {
  return <div ref={hostRef} className="player-dock" aria-label="Players do YouTube" />
}
