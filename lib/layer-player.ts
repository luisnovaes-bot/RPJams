"use client"

import { serverNow } from "./clock"
import type { LayerState } from "./types"

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    YT?: any
    onYouTubeIframeAPIReady?: () => void
  }
}

let apiPromise: Promise<any> | undefined

function loadYouTubeApi(): Promise<any> {
  if (apiPromise) return apiPromise
  apiPromise = new Promise((resolve) => {
    if (window.YT?.Player) return resolve(window.YT)
    window.onYouTubeIframeAPIReady = () => resolve(window.YT)
    const script = document.createElement("script")
    script.src = "https://www.youtube.com/iframe_api"
    document.head.appendChild(script)
  })
  return apiPromise
}

const FADE_MS = 1500
const DRIFT_TOLERANCE_S = 1.5
const PLAYING = 1
const BUFFERING = 3

export type LayerStatus = "silencio" | "carregando" | "aguardando" | "tocando" | "pausado" | "terminou" | "erro"

/**
 * Plays one layer in this browser and keeps it on the shared timeline:
 * the position everyone should be at comes from started_at_ms and the server clock.
 */
export class LayerPlayer {
  private player: any
  private ready = false
  private desired: LayerState | null = null
  private loadedKey: string | null = null
  private loadedId: string | null = null
  private fade = 0
  private fadeTarget = 0
  private localVolume = 100
  private timers: ReturnType<typeof setInterval>[] = []
  private lastStatus: LayerStatus = "silencio"
  private lastReportedKey: string | null = null
  private errored: string | null = null

  constructor(
    element: HTMLElement,
    private onStatus: (status: LayerStatus, trackKey: string | null) => void
  ) {
    loadYouTubeApi().then((YT) => {
      this.player = new YT.Player(element, {
        width: 200,
        height: 200,
        playerVars: { autoplay: 0, controls: 0, disablekb: 1, playsinline: 1, rel: 0, iv_load_policy: 3, fs: 0 },
        events: {
          onReady: () => {
            this.ready = true
            this.sync()
          },
          onStateChange: (event: any) => {
            if (event.data === 0 && this.desired?.loop) this.sync()
          },
          onError: () => {
            this.errored = this.loadedId
            this.report()
          },
        },
      })
    })
    this.timers.push(setInterval(() => this.stepFade(), 100))
    this.timers.push(setInterval(() => this.sync(), 1000))
  }

  setDesired(state: LayerState | null) {
    this.desired = state
    this.applyVolume()
    this.sync()
  }

  setLocalVolume(volume: number) {
    this.localVolume = volume
    this.applyVolume()
  }

  /** Seconds into the video right now, if something is loaded. */
  currentTime(): number | undefined {
    if (!this.ready || !this.loadedId) return undefined
    return this.player.getCurrentTime?.()
  }

  /** Video length in seconds, once YouTube knows it. */
  duration(): number | undefined {
    if (!this.ready || !this.loadedId) return undefined
    const d = this.player.getDuration?.()
    return d > 0 ? d : undefined
  }

  destroy() {
    this.timers.forEach(clearInterval)
    this.player?.destroy?.()
  }

  private expected(state: LayerState, duration: number) {
    if (state.paused) return { waiting: true, ended: false, position: state.paused_position }
    const elapsed = (serverNow() - state.started_at_ms) / 1000
    if (elapsed < 0) return { waiting: true, ended: false, position: state.start_seconds }
    const length = duration - state.start_seconds
    if (state.loop && length > 1) {
      return { waiting: false, ended: false, position: state.start_seconds + (elapsed % length) }
    }
    const position = state.start_seconds + elapsed
    return { waiting: false, ended: duration > 0 && position >= duration - 0.3, position }
  }

  private sync() {
    if (!this.ready) return
    const state = this.desired
    const wantId = state?.youtube_id ?? null
    // A different track (even of the same video) fades out and back in. Changing loop or
    // replaying keeps the key, and the drift check below moves the position instead.
    const wantKey = state && wantId ? `${state.track_id}:${wantId}` : null

    if (wantKey !== this.loadedKey) {
      if (this.loadedKey && this.fade > 0.02) {
        this.fadeTarget = 0
        return
      }
      if (!wantId || !state) {
        if (this.loadedId) this.player.stopVideo()
        this.loadedId = null
        this.loadedKey = null
        this.report("silencio")
        return
      }
      this.errored = null
      this.fade = 0
      this.applyVolume()
      this.player.loadVideoById({ videoId: wantId, startSeconds: this.expected(state, 0).position })
      this.loadedId = wantId
      this.loadedKey = wantKey
      this.fadeTarget = 1
    }

    if (!state || !wantId) return
    if (this.errored === wantId) return this.report("erro")

    if (state.paused) {
      // Fade out, then hold the video where it is.
      this.fadeTarget = 0
      if (this.fade === 0 && this.player.getPlayerState?.() === PLAYING) this.player.pauseVideo()
      // The master can move the position while paused.
      const current: number = this.player.getCurrentTime?.() ?? 0
      if (this.fade === 0 && Math.abs(current - state.paused_position) > DRIFT_TOLERANCE_S) this.player.seekTo(state.paused_position, true)
      return this.report("pausado")
    }

    const duration: number = this.player.getDuration?.() ?? 0
    const { waiting, ended, position } = this.expected(state, duration)
    const playerState = this.player.getPlayerState?.()

    if (waiting) {
      if (playerState === PLAYING) this.player.pauseVideo()
      return this.report("aguardando")
    }
    if (ended) {
      if (playerState === PLAYING || playerState === BUFFERING) this.player.pauseVideo()
      return this.report("terminou")
    }
    if (playerState !== PLAYING && playerState !== BUFFERING) this.player.playVideo()
    const current: number = this.player.getCurrentTime?.() ?? 0
    if (duration > 0 && Math.abs(current - position) > DRIFT_TOLERANCE_S) this.player.seekTo(position, true)
    this.fadeTarget = 1
    this.report(playerState === PLAYING ? "tocando" : "carregando")
  }

  private stepFade() {
    if (this.fade === this.fadeTarget) return
    const step = 100 / FADE_MS
    this.fade = this.fadeTarget > this.fade ? Math.min(this.fadeTarget, this.fade + step) : Math.max(this.fadeTarget, this.fade - step)
    this.applyVolume()
    if (this.fade === 0 && this.fadeTarget === 0) this.sync()
  }

  private applyVolume() {
    if (!this.ready) return
    const layerVolume = this.desired?.volume ?? 80
    this.player.setVolume?.(Math.round(layerVolume * (this.localVolume / 100) * this.fade))
  }

  private report(status?: LayerStatus) {
    const next = status ?? (this.errored ? "erro" : this.lastStatus)
    // The key says which track the status is about, so "terminou" of the old
    // track is never mistaken for the new one.
    if (next !== this.lastStatus || this.loadedKey !== this.lastReportedKey) {
      this.lastStatus = next
      this.lastReportedKey = this.loadedKey
      this.onStatus(next, this.loadedKey)
    }
  }
}
