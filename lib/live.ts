"use client"

import { useEffect, useState } from "react"
import { createRealtimeClient, type SealedLiveQuery } from "@neon/realtime/client"

type Client = ReturnType<typeof createRealtimeClient>
let client: Client | undefined

function getClient(): Client {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_NEON_REALTIME_URL!.replace(/^http/, "ws")
    client = createRealtimeClient({ url, logLevel: "warn" })
  }
  return client
}

async function fetchSealed<Row>(body: object): Promise<SealedLiveQuery<Row>> {
  const res = await fetch("/api/live", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Não consegui abrir a conexão (${res.status})`)
  return (await res.json()) as SealedLiveQuery<Row>
}

/** Rows of a live query that update by themselves while the page is open. */
export function useLiveRows<Row>(request: object | null): { rows: Row[] | undefined; connected: boolean } {
  const [rows, setRows] = useState<Row[] | undefined>(undefined)
  const [connected, setConnected] = useState(false)
  const key = request ? JSON.stringify(request) : null

  useEffect(() => {
    if (!key) return
    const body = JSON.parse(key) as object
    let cancelled = false
    let renewTimer: ReturnType<typeof setTimeout> | undefined
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    let unsubscribe: (() => void) | undefined

    async function start() {
      try {
        const sealed = await fetchSealed<Row>(body)
        if (cancelled) return
        const sub = getClient().subscribe(sealed)
        unsubscribe = () => sub.unsubscribe()
        sub.onChange((snapshot) => {
          if (snapshot.data) setRows([...snapshot.data])
          setConnected(snapshot.status === "live")
          if (snapshot.status === "error") restart()
        })
        const scheduleRenew = (expiresAt: number) => {
          renewTimer = setTimeout(async () => {
            try {
              const next = await fetchSealed<Row>(body)
              scheduleRenew(next.expiresAt)
              await sub.renew(next)
            } catch {
              restart()
            }
          }, Math.max(0, expiresAt - Date.now() - 10_000))
        }
        scheduleRenew(sealed.expiresAt)
      } catch {
        restart()
      }
    }

    function restart() {
      if (cancelled) return
      clearTimeout(renewTimer)
      unsubscribe?.()
      unsubscribe = undefined
      setConnected(false)
      clearTimeout(retryTimer)
      retryTimer = setTimeout(start, 3000)
    }

    start()
    return () => {
      cancelled = true
      clearTimeout(renewTimer)
      clearTimeout(retryTimer)
      unsubscribe?.()
    }
  }, [key])

  return { rows, connected }
}
