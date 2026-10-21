"use client"

// Estimates the gap between this computer's clock and the server's, so every
// browser agrees on when a track started.
let offsetMs = 0
let started = false

async function sample(): Promise<{ offset: number; rtt: number } | undefined> {
  try {
    const t0 = Date.now()
    const res = await fetch("/api/time", { cache: "no-store" })
    const t1 = Date.now()
    const { now } = (await res.json()) as { now: number }
    return { offset: now - (t0 + t1) / 2, rtt: t1 - t0 }
  } catch {
    return undefined
  }
}

async function sync() {
  const samples = []
  for (let i = 0; i < 4; i++) {
    const s = await sample()
    if (s) samples.push(s)
  }
  if (samples.length) {
    samples.sort((a, b) => a.rtt - b.rtt)
    offsetMs = samples[0].offset
  }
}

export function startClockSync(): Promise<void> {
  if (started) return Promise.resolve()
  started = true
  setInterval(sync, 60_000)
  return sync()
}

export function serverNow(): number {
  return Date.now() + offsetMs
}
