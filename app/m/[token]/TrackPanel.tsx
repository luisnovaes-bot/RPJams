"use client"

import { useState } from "react"
import type { Track } from "@/lib/types"
import { parsePlaylistId } from "@/lib/youtube"

type Call = (action: string, data?: object) => Promise<unknown>

type Props = {
  layer: number
  listId: string
  tracks: Track[]
  currentTrackId: string | null
  /** True while the layer is actually playing; the current track is shown greyed out otherwise. */
  playing: boolean
  seekBar: React.ReactNode
  call: Call
  onImportPlaylist: (listId: string, playlistId: string) => Promise<boolean>
}

/**
 * All the tracks of a layer. The title row and the link field stay put; only the tracks scroll.
 * A pasted playlist just adds its videos here, in order.
 */
export function TrackPanel({ layer, listId, tracks, currentTrackId, playing, seekBar, call, onImportPlaylist }: Props) {
  const [url, setUrl] = useState("")
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState("")

  async function add() {
    if (!url.trim()) return
    setAdding(true)
    const playlistId = parsePlaylistId(url)
    const ok = playlistId ? await onImportPlaylist(listId, playlistId) : await call("addTrack", { listId, url })
    if (ok) setUrl("")
    setAdding(false)
  }

  function move(index: number, delta: number) {
    const ids = tracks.map((t) => t.id)
    const target = index + delta
    if (target < 0 || target >= ids.length) return
    ;[ids[index], ids[target]] = [ids[target], ids[index]]
    call("reorderTracks", { listId, trackIds: ids })
  }

  async function finishEdit() {
    if (editing && draft.trim()) await call("renameTrack", { trackId: editing, title: draft })
    setEditing(null)
  }

  return (
    <div className="track-panel">
      <div className="track-panel-head">
        <h3>
          Faixas <span className="muted small">{tracks.length}</span>
        </h3>
        <button
          className="ghost"
          title="Remover todas as faixas"
          onClick={() => window.confirm("Remover todas as faixas desta camada?") && call("clearTracks", { layer })}
        >
          🗑
        </button>
      </div>

      <div className="layer-scroll">
        {tracks.map((track, index) => (
          <div key={track.id} className={`track ${track.id === currentTrackId ? (playing ? "current playing" : "current paused") : ""}`}>
            <div className="track-row">
              {editing === track.id ? (
                <input
                  type="text"
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={finishEdit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") finishEdit()
                    if (e.key === "Escape") setEditing(null)
                  }}
                />
              ) : (
                <button className="play" title="Tocar esta faixa" onClick={() => call("play", { trackId: track.id })}>
                  {track.title}
                </button>
              )}
              <button
                className="ghost"
                title="Renomear"
                onClick={() => {
                  setEditing(track.id)
                  setDraft(track.title)
                }}
              >
                ✎
              </button>
              <button className="ghost" title="Subir" disabled={index === 0} onClick={() => move(index, -1)}>
                ↑
              </button>
              <button className="ghost" title="Descer" disabled={index === tracks.length - 1} onClick={() => move(index, 1)}>
                ↓
              </button>
              <button className="ghost" title="Remover" onClick={() => call("deleteTrack", { trackId: track.id })}>
                ✕
              </button>
            </div>
            {track.id === currentTrackId && seekBar}
          </div>
        ))}
      </div>

      <div className="row track-panel-foot">
        <input
          type="url"
          placeholder="Colar link do YouTube"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <button onClick={add} disabled={adding}>
          {adding ? "…" : "Adicionar"}
        </button>
      </div>
    </div>
  )
}
