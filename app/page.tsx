"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { CopyLink } from "@/components/CopyLink"
import { LogoHero } from "@/components/Logo"
import { ThemeToggle } from "@/components/ThemeToggle"
import { load, save } from "@/lib/storage"

type Created = { roomId: string; masterToken: string; name: string }

export default function Home() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [created, setCreated] = useState<Created | null>(null)
  const [saved, setSaved] = useState<Created[]>([])
  const [origin, setOrigin] = useState("")

  useEffect(() => {
    setOrigin(window.location.origin)
    const local = load<Created[]>("rpjams:rooms", [])
    setSaved(local)
    if (!local.length) return
    // Drop rooms deleted elsewhere (e.g. in the admin panel) and pick up renames.
    fetch("/api/rooms/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tokens: local.map((r) => r.masterToken) }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { rooms: Created[] } | null) => {
        if (!data) return
        const alive = local
          .map((room) => data.rooms.find((r) => r.masterToken === room.masterToken))
          .filter((room): room is Created => !!room)
        setSaved(alive)
        save("rpjams:rooms", alive)
      })
      .catch(() => {})
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
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error)
      }
      const data = (await res.json()) as { roomId: string; masterToken: string }
      const room = { ...data, name: name.trim() || "Mesa de RPG" }
      const rooms = [room, ...saved]
      save("rpjams:rooms", rooms)
      setSaved(rooms)
      setCreated(room)
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Não consegui criar a sala. Tente de novo.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="center home stack">
      <div className="corner">
        <ThemeToggle />
      </div>
      <LogoHero />
      <p className="muted intro">
        O RPJams é a trilha sonora da sua mesa de RPG online. O mestre monta camadas de som com vídeos do YouTube e comanda tudo pelo
        painel de mestre. Os jogadores só precisam entrar no link para ouvir exatamente o mesmo som ao mesmo tempo.
      </p>

      {created ? (
        <div className="card stack">
          <h2>Sala “{created.name}” criada</h2>
          <p className="muted">
            Cada sala tem dois links. O link de mestre abre o painel de controle, onde você monta as camadas, escolhe as faixas e comanda
            o som da mesa. Quem tiver esse link controla a sala. O link dos jogadores é o que você manda para o grupo. Ele abre só a tela
            para ouvir. A sala fica salva, então os mesmos links servem para todas as sessões.
          </p>
          <div className="stack">
            <strong>Seu link de mestre (guarde, ele não pode ser recuperado)</strong>
            <CopyLink url={`${origin}/m/${created.masterToken}`} />
          </div>
          <div className="stack">
            <strong>Link para os jogadores</strong>
            <CopyLink url={`${origin}/s/${created.roomId}`} />
          </div>
          {/* An in-app navigation keeps this click's permission to play sound, so the master
              page can skip its "click to enable sound" step. */}
          <button className="primary" onClick={() => router.push(`/m/${created.masterToken}?entrar=1`)}>
            Abrir a sala como mestre
          </button>
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
