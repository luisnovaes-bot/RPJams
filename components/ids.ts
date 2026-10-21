"use client"

/** One id per browser tab, so the master and a player in the same browser don't overwrite each other. */
export function clientId(): string {
  try {
    let id = sessionStorage.getItem("rpjams:client")
    if (!id) {
      id = crypto.randomUUID()
      sessionStorage.setItem("rpjams:client", id)
    }
    return id
  } catch {
    return crypto.randomUUID()
  }
}
