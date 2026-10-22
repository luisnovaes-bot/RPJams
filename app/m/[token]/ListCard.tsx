"use client"

import { useState } from "react"
import type { List } from "@/lib/types"
import { parsePlaylistId } from "@/lib/youtube"

type Call = (action: string, data?: object) => Promise<unknown>

type Props = {
  list: List
  currentTrackId: string | null
  /** True while the layer is actually playing; the current track is shown greyed out otherwise. */
  playing: boolean
  seekBar: React.ReactNode
  call: Call
  onImportPlaylist: (listId: string, playlistId: string) => Promise<boolean>
}

export function ListCard({ list, currentTrackId, playing, seekBar, call, onImportPlaylist }: Props) {
  const [url, setUrl] = useState("")
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState("")

  async function add() {
    if (!url.trim()) return
    setAdding(true)
    // A playlist link brings every video of the playlist, in order.
    const playlistId = parsePlaylistId(url)
    const ok = playlistId ? await onImportPlaylist(list.id, playlistId) : await call("addTrack", { listId: list.id, url })
    if (ok) setUrl("")
    setAdding(false)
  }

  function move(index: number, delta: number) {
    const ids = list.tracks.map((t) => t.id)
    const target = index + delta
    if (target < 0 || target >= ids.length) return
    ;[ids[index], ids[target]] = [ids[target], ids[index]]
    call("reorderTracks", { listId: list.id, trackIds: ids })
  }

  function startEdit(id: string, value: string) {
    setEditing(id)
    setDraft(value)
  }

  async function finishEdit() {
    if (editing === "list") await call("renameList", { listId: list.id, name: draft })
    else if (editing) await call("renameTrack", { trackId: editing, title: draft })
    setEditing(null)
  }

  const editor = (
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
  )

  return (
    <div className="list">
      <div className="list-head">
        {editing === "list" ? (
          editor
        ) : (
          <h3 title="Clique duas vezes para renomear" onDoubleClick={() => startEdit("list", list.name)}>
            {list.name}
          </h3>
        )}
        <button
          className={list.loop_default ? "on small" : "small"}
          title="Ao tocar uma faixa desta lista, o loop da camada começa assim"
          onClick={() => call("setListLoop", { listId: list.id, loop: !list.loop_default })}
        >
          Loop padrão {list.loop_default ? "sim" : "não"}
        </button>
        <button
          className="ghost"
          title="Apagar lista"
          onClick={() => window.confirm(`Apagar a lista “${list.name}” e todas as faixas dela?`) && call("deleteList", { listId: list.id })}
        >
          🗑
        </button>
      </div>

      {list.tracks.length === 0 && <span className="small muted">Cole um link do YouTube abaixo para adicionar.</span>}

      {list.tracks.map((track, index) => (
        <div key={track.id} className={`track ${track.id === currentTrackId ? (playing ? "current playing" : "current paused") : ""}`}>
          <div className="track-row">
          {editing === track.id ? (
            editor
          ) : (
            <button className="play" title="Tocar esta faixa" onClick={() => call("play", { trackId: track.id })}>
              {track.title}
            </button>
          )}
          <button className="ghost" title="Renomear" onClick={() => startEdit(track.id, track.title)}>
            ✎
          </button>
          <button className="ghost" title="Subir" disabled={index === 0} onClick={() => move(index, -1)}>
            ↑
          </button>
          <button className="ghost" title="Descer" disabled={index === list.tracks.length - 1} onClick={() => move(index, 1)}>
            ↓
          </button>
          <button className="ghost" title="Remover" onClick={() => call("deleteTrack", { trackId: track.id })}>
            ✕
          </button>
          </div>
          {track.id === currentTrackId && seekBar}
        </div>
      ))}

      <div className="row">
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
