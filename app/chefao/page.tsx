"use client"

import { useCallback, useEffect, useState } from "react"
import type { AdminRoom } from "@/lib/types"
import { CopyLink } from "@/components/CopyLink"
import { ThemeToggle } from "@/components/ThemeToggle"

type State = "loading" | "login" | "off" | "ready"

function when(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
}

export default function AdminPage() {
  const [state, setState] = useState<State>("loading")
  const [rooms, setRooms] = useState<AdminRoom[]>([])
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [origin, setOrigin] = useState("")
  const [filter, setFilter] = useState<"todas" | "ativas">("todas")

  const call = useCallback(async (action: string, data: object = {}) => {
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...data }),
    })
    const body = (await res.json().catch(() => ({}))) as { rooms?: AdminRoom[]; error?: string }
    if (res.status === 401) return setState("login")
    if (res.status === 503) return setState("off")
    if (!res.ok) return setError(body.error ?? "Algo deu errado")
    setError("")
    setRooms(body.rooms ?? [])
    setState("ready")
  }, [])

  useEffect(() => {
    setOrigin(window.location.origin)
    call("list")
  }, [call])

  // Who is connected changes all the time, so refresh every 10 seconds.
  useEffect(() => {
    if (state !== "ready") return
    const timer = setInterval(() => call("list"), 10_000)
    return () => clearInterval(timer)
  }, [state, call])

  async function login() {
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    })
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      return setError(body.error ?? "Não foi possível entrar")
    }
    setPassword("")
    call("list")
  }

  async function logout() {
    await fetch("/api/admin/login", { method: "DELETE" })
    setRooms([])
    setState("login")
  }

  if (state === "loading") return <main className="center muted">Carregando…</main>

  if (state === "off") {
    return (
      <main className="center stack">
        <h1>Painel desligado</h1>
        <p className="muted">Configure a variável ADMIN_PASSWORD no servidor para ativar o painel.</p>
      </main>
    )
  }

  if (state === "login") {
    return (
      <main className="center stack">
        <div className="corner">
          <ThemeToggle />
        </div>
        <h1>RPJams · Admin</h1>
        <div className="card stack">
          <input
            type="password"
            placeholder="Senha do painel"
            value={password}
            autoFocus
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && login()}
          />
          <button className="primary" onClick={login}>
            Entrar
          </button>
          {error && <p className="error">{error}</p>}
        </div>
      </main>
    )
  }

  const active = rooms.filter((r) => r.people.length > 0)
  const shown = filter === "ativas" ? active : rooms
  const online = rooms.reduce((sum, r) => sum + r.people.length, 0)

  return (
    <main className="page">
      <header className="card header">
        <div className="header-top">
          <div className="stack" style={{ gap: 2 }}>
            <h1>RPJams · Admin</h1>
            <span className="small muted">
              {rooms.length} salas · {active.length} em uso agora · {online} pessoas conectadas · atualiza a cada 10 s
            </span>
          </div>
          <div className="row">
            <button className={filter === "todas" ? "on" : ""} onClick={() => setFilter("todas")}>
              Todas
            </button>
            <button className={filter === "ativas" ? "on" : ""} onClick={() => setFilter("ativas")}>
              Em uso
            </button>
            <button onClick={logout}>Sair</button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {error && <p className="error">{error}</p>}
      {shown.length === 0 && <p className="muted">Nenhuma sala {filter === "ativas" ? "em uso agora" : "criada ainda"}.</p>}

      <div className="admin-rooms">
        {shown.map((room) => (
          <section key={room.id} className="card stack">
            <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
              <div className="stack" style={{ gap: 2 }}>
                <h2>{room.name}</h2>
                <span className="small muted">
                  Criada em {when(room.created_at)} · {room.lists} listas · {room.tracks} faixas
                </span>
              </div>
              <div className="row">
                <button
                  onClick={() => {
                    const name = window.prompt("Novo nome da sala", room.name)
                    if (name?.trim()) call("rename", { roomId: room.id, name })
                  }}
                >
                  Renomear
                </button>
                <button
                  title="Gera um link de mestre novo; o antigo para de funcionar"
                  onClick={() =>
                    window.confirm(`Trocar o link de mestre de “${room.name}”? O link atual para de funcionar na hora.`) &&
                    call("resetMaster", { roomId: room.id })
                  }
                >
                  Novo link de mestre
                </button>
                <button
                  className="danger"
                  onClick={() =>
                    window.confirm(`Apagar a sala “${room.name}” com todas as listas e faixas? Não dá para desfazer.`) &&
                    call("delete", { roomId: room.id })
                  }
                >
                  Apagar
                </button>
              </div>
            </div>

            <div className="admin-grid">
              <div className="stack" style={{ gap: 4 }}>
                <span className="small muted">Link de mestre</span>
                <CopyLink url={`${origin}/m/${room.master_token}`} />
              </div>
              <div className="stack" style={{ gap: 4 }}>
                <span className="small muted">Link dos jogadores</span>
                <CopyLink url={`${origin}/s/${room.id}`} />
              </div>
            </div>

            <div className="row" style={{ flexWrap: "wrap" }}>
              <strong className="small">Conectados:</strong>
              <div className="people">
                {room.people.length === 0 && <span className="muted small">Ninguém agora</span>}
                {room.people.map((p, i) => (
                  <span key={i} className={`pill ${p.audio_ok ? "ok" : "warn"}`}>
                    {p.nickname}
                    {p.audio_ok ? "" : " (sem som)"}
                  </span>
                ))}
              </div>
            </div>

            {room.layers.length > 0 && (
              <div className="stack small" style={{ gap: 2 }}>
                {room.layers.map((l) => (
                  <span key={l.layer}>
                    <span className="muted">
                      Camada {l.layer} ({l.label}) {l.paused ? "pausada" : "tocando"}:
                    </span>{" "}
                    {l.title ?? "faixa removida"}
                  </span>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </main>
  )
}
