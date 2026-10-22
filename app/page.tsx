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
      <p className="muted">
        O RPJams é a trilha sonora da sua mesa de RPG online. O mestre monta camadas de som com vídeos e playlists do YouTube, como uma
        para a música e outra para a chuva ou a taverna, e comanda tudo pelo painel de mestre: o que toca, quando pausa, o volume e o
        loop. Os jogadores abrem o painel de jogador, clicam para entrar e passam a ouvir exatamente o mesmo som, no mesmo momento,
        cabendo a cada um só ajustar o próprio volume.
      </p>

      {created ? (
        <div className="card stack">
          <h2>Sala “{created.name}” criada</h2>
          <p className="muted">
            Cada sala tem dois links. O link de mestre abre o painel de controle, onde você monta as camadas, escolhe as faixas e comanda
            o som da mesa. Guarde-o como uma senha: quem tiver esse link controla a sala, e ele não pode ser recuperado. O link dos
            jogadores é o que você manda para o grupo. Ele abre só o painel de ouvir, onde cada pessoa entra com um nome, ajusta o
            próprio volume e acompanha o que você toca, sem ver o nome das faixas. A sala fica salva, então os mesmos links servem para
            todas as sessões.
          </p>
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
