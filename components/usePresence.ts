"use client"

import { useEffect } from "react"

/** Tells the master this person is here, every 15 seconds. */
export function usePresence(target: { roomId?: string; masterToken?: string } | null, clientId: string, nickname: string, audioOk: boolean) {
  const key = target ? JSON.stringify(target) : null
  useEffect(() => {
    if (!key || !clientId) return
    const base = JSON.parse(key) as object
    const send = (extra: object = {}) =>
      fetch("/api/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...base, clientId, nickname, audioOk, ...extra }),
        keepalive: true,
      }).catch(() => {})
    send()
    const timer = setInterval(send, 15_000)
    const leave = () => send({ leaving: true })
    window.addEventListener("pagehide", leave)
    return () => {
      clearInterval(timer)
      window.removeEventListener("pagehide", leave)
    }
  }, [key, clientId, nickname, audioOk])
}
