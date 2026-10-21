"use client"

import { useEffect, useState } from "react"
import type { LayerPlayer } from "@/lib/layer-player"

/**
 * Formats seconds with as many digits as the track's length uses (3:04:55 → 0:01:36),
 * so the label never changes width.
 */
function clock(seconds: number, length: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, "0")
  if (length >= 3600) return `${h}:${String(m).padStart(2, "0")}:${ss}`
  if (length >= 600) return `${String(m).padStart(2, "0")}:${ss}`
  return `${m}:${ss}`
}

/** Shows where the current track is and lets the master jump to any point of it. */
export function SeekBar({ getPlayer, onSeek }: { getPlayer: () => LayerPlayer | undefined; onSeek: (position: number) => void }) {
  const [position, setPosition] = useState(0)
  const [duration, setDuration] = useState<number | undefined>(undefined)
  const [dragging, setDragging] = useState<number | null>(null)

  useEffect(() => {
    const read = () => {
      const player = getPlayer()
      setPosition(player?.currentTime() ?? 0)
      setDuration(player?.duration())
    }
    read()
    const timer = setInterval(read, 500)
    return () => clearInterval(timer)
  }, [getPlayer])

  if (!duration) return <div className="seek muted small">Carregando duração…</div>

  const shown = dragging ?? position
  const commit = () => {
    if (dragging !== null) onSeek(dragging)
    setDragging(null)
  }

  return (
    <div className="seek">
      <span className="small muted">{clock(shown, duration)}</span>
      <input
        type="range"
        min={0}
        max={duration}
        step={1}
        value={Math.min(shown, duration)}
        onChange={(e) => setDragging(Number(e.target.value))}
        onPointerUp={commit}
        onKeyUp={commit}
        aria-label="Posição da faixa"
      />
      <span className="small muted">{clock(duration, duration)}</span>
    </div>
  )
}
