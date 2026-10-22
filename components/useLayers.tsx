"use client"

import { useEffect, useRef, useState } from "react"
import { LayerPlayer, type LayerStatus } from "@/lib/layer-player"
import type { LayerState } from "@/lib/types"

/**
 * Runs one YouTube player per layer once audio is unlocked, fed by the live layer state.
 * Players are added and removed as the master creates or deletes layers.
 */
export function useLayers(enabled: boolean, states: LayerState[] | undefined, localVolumes: Record<number, number>) {
  const hostRef = useRef<HTMLDivElement>(null)
  const playersRef = useRef<Record<number, LayerPlayer>>({})
  const framesRef = useRef<Record<number, HTMLElement>>({})
  const [statuses, setStatuses] = useState<Record<number, LayerStatus>>({})
  const [statusKeys, setStatusKeys] = useState<Record<number, string | null>>({})

  // Tear everything down when leaving the session.
  useEffect(() => {
    if (!enabled) return
    const host = hostRef.current
    return () => {
      Object.values(playersRef.current).forEach((p) => p.destroy())
      host?.replaceChildren()
      playersRef.current = {}
      framesRef.current = {}
    }
  }, [enabled])

  useEffect(() => {
    const host = hostRef.current
    if (!enabled || !host || !states) return
    const wanted = new Set(states.map((s) => s.layer))

    for (const layer of Object.keys(playersRef.current).map(Number)) {
      if (wanted.has(layer)) continue
      playersRef.current[layer].destroy()
      framesRef.current[layer]?.remove()
      delete playersRef.current[layer]
      delete framesRef.current[layer]
    }

    for (const layer of [...wanted].sort((a, b) => a - b)) {
      if (!playersRef.current[layer]) {
        const frame = document.createElement("div")
        frame.className = "player-frame"
        frame.dataset.layer = String(layer)
        const slot = document.createElement("div")
        frame.appendChild(slot)
        // Keep the dock in layer order.
        const next = [...host.children].find((el) => Number((el as HTMLElement).dataset.layer) > layer)
        host.insertBefore(frame, next ?? null)
        framesRef.current[layer] = frame
        playersRef.current[layer] = new LayerPlayer(slot, (status, key) => {
          setStatuses((s) => ({ ...s, [layer]: status }))
          setStatusKeys((s) => ({ ...s, [layer]: key }))
        })
        playersRef.current[layer].setLocalVolume(localVolumes[layer] ?? 100)
      }
      playersRef.current[layer].setDesired(states.find((s) => s.layer === layer) ?? null)
    }
    // Handy for checking sync from the browser console.
    ;(window as unknown as { rpjams: unknown }).rpjams = playersRef.current
    // localVolumes is applied by its own effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [states, enabled])

  useEffect(() => {
    for (const [layer, player] of Object.entries(playersRef.current)) player.setLocalVolume(localVolumes[Number(layer)] ?? 100)
  }, [localVolumes, enabled])

  return { hostRef, playersRef, statuses, statusKeys }
}

/** The YouTube players. YouTube's terms ask for at least 200x200 and visible, so they sit in a corner. */
export function PlayerDock({ hostRef }: { hostRef: React.RefObject<HTMLDivElement | null> }) {
  return <div ref={hostRef} className="player-dock" aria-label="Players do YouTube" />
}
