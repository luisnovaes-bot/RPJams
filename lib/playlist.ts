"use client"

import { loadYouTubeApi } from "./layer-player"

/**
 * Reads the video ids of a YouTube playlist, in the playlist's order, through the official
 * player: it loads the playlist without playing and asks for its list. No API key needed.
 * The player is shown (muted) in the dock while it works, as YouTube's terms require.
 */
export async function playlistVideoIds(listId: string, dock: HTMLElement): Promise<string[]> {
  const YT = await loadYouTubeApi()
  const frame = document.createElement("div")
  frame.className = "player-frame"
  const slot = document.createElement("div")
  frame.appendChild(slot)
  dock.appendChild(frame)

  return new Promise((resolve, reject) => {
    let timer: ReturnType<typeof setInterval> | undefined
    let player: { getPlaylist?: () => string[] | null; mute?: () => void; destroy?: () => void } | undefined
    const finish = (ids: string[] | null) => {
      clearInterval(timer)
      clearTimeout(giveUp)
      player?.destroy?.()
      frame.remove()
      if (ids?.length) resolve(ids)
      else reject(new Error("Não consegui ler essa playlist. Ela é pública?"))
    }
    const giveUp = setTimeout(() => finish(null), 20_000)
    player = new YT.Player(slot, {
      width: 200,
      height: 200,
      playerVars: { listType: "playlist", list: listId, autoplay: 0, controls: 0 },
      events: {
        onReady: () => {
          player?.mute?.()
          let last = -1
          let stable = 0
          // The list can arrive in steps, so wait until its size stops changing.
          timer = setInterval(() => {
            const ids = player?.getPlaylist?.() ?? null
            const size = ids?.length ?? 0
            stable = size > 0 && size === last ? stable + 1 : 0
            last = size
            if (stable >= 3) finish(ids)
          }, 400)
        },
        onError: () => finish(null),
      },
    })
  })
}
