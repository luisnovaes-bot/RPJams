"use client"

import { useEffect, useState } from "react"
import { CopyLink } from "@/components/CopyLink"
import { ThemeToggle } from "@/components/ThemeToggle"
import { load, save } from "@/lib/storage"

type Created = { roomId: string; masterToken: string; name: string }

export default function Home() {
  const [name, setName] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [created, setCreated] = useState<Created | null>(null)
  const [saved, setSaved] = useState<Created[]>([])
  const [origin, setOrigin] = useState("")

  useEffect(() => {
    setOrigin(window.location.origin)
    setSaved(load<Created[]>("rpjams:rooms", []))
  }, [])

  async function create() {
    setBusy(true)
    setError("")
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) throw new Error()
      const data = (await res.json()) as { roomId: string; masterToken: string }
      const room = { ...data, name: name.trim() || "Mesa de RPG" }
      const rooms = [room, ...saved]
      save("rpjams:rooms", rooms)
      setSaved(rooms)
      setCreated(room)
    } catch {
      setError("Não consegui criar a sala. Tente de novo.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="center stack">
      <div className="corner">
        <ThemeToggle />
      </div>
      <h1>RPJams</h1>
      <p className="muted">Música e ambiente tocando juntos para toda a mesa. O mestre controla, os jogadores ouvem.</p>

      {created ? (
        <div className="card stack">
          <h2>Sala “{created.name}” criada</h2>
          <div className="stack">
            <strong>Seu link de mestre (guarde, ele não pode ser recuperado)</strong>
            <CopyLink url={`${origin}/m/${created.masterToken}`} />
          </div>
          <div className="stack">
            <strong>Link para os jogadores</strong>
            <CopyLink url={`${origin}/s/${created.roomId}`} />
          </div>
          <a href={`/m/${created.masterToken}`}>
            <button className="primary">Abrir a sala como mestre</button>
          </a>
        </div>
      ) : (
        <div className="card stack">
          <h2>Criar uma sala</h2>
          <input type="text" placeholder="Nome da mesa (ex.: Campanha de Strahd)" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="primary" onClick={create} disabled={busy}>
            {busy ? "Criando…" : "Criar sala"}
          </button>
          {error && <p className="error">{error}</p>}
        </div>
      )}

      {saved.length > 0 && !created && (
        <div className="card stack">
          <h2>Suas salas neste computador</h2>
          {saved.map((room) => (
            <a key={room.roomId} href={`/m/${room.masterToken}`}>
              {room.name}
            </a>
          ))}
        </div>
      )}
    </main>
  )
}
