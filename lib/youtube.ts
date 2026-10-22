const ID = /^[A-Za-z0-9_-]{11}$/

/** Reads a "t" value like 90, 90s or 1m30s into seconds. */
function parseTime(value: string | null): number {
  if (!value) return 0
  if (/^\d+$/.test(value)) return Number(value)
  const match = value.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/)
  if (!match) return 0
  const [, h, m, s] = match
  return Number(h ?? 0) * 3600 + Number(m ?? 0) * 60 + Number(s ?? 0)
}

const LIST_ID = /^[A-Za-z0-9_-]{10,64}$/

/** The playlist id in a YouTube link (watch?v=…&list=… or playlist?list=…), if there is one. */
export function parsePlaylistId(input: string): string | undefined {
  try {
    const url = new URL(input.trim())
    const host = url.hostname.replace(/^www\.|^m\.|^music\./, "")
    if (host !== "youtube.com" && host !== "youtu.be") return undefined
    const list = url.searchParams.get("list")
    return list && LIST_ID.test(list) ? list : undefined
  } catch {
    return undefined
  }
}

export const VIDEO_ID = ID

export function parseYouTubeUrl(input: string): { youtubeId: string; startSeconds: number } | undefined {
  let url: URL
  try {
    url = new URL(input.trim())
  } catch {
    return undefined
  }
  const host = url.hostname.replace(/^www\.|^m\.|^music\./, "")
  let id: string | null = null
  if (host === "youtu.be") {
    id = url.pathname.slice(1).split("/")[0]
  } else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (url.pathname === "/watch") id = url.searchParams.get("v")
    else {
      const match = url.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/]+)/)
      id = match?.[1] ?? null
    }
  }
  if (!id || !ID.test(id)) return undefined
  const startSeconds = parseTime(url.searchParams.get("t") ?? url.searchParams.get("start"))
  return { youtubeId: id, startSeconds }
}

/** Title from YouTube's oEmbed. Fails for private videos and ones whose owner blocked embedding. */
export async function fetchYouTubeTitle(youtubeId: string): Promise<string | undefined> {
  const watch = `https://www.youtube.com/watch?v=${youtubeId}`
  const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(watch)}`)
  if (!res.ok) return undefined
  const data = (await res.json()) as { title?: string }
  return data.title
}
