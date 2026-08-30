/**
 * Free quota rate-limit tracker for OpenCode Zen.
 *
 * Zen has no public quota API, so we infer usage from 429 responses.
 * Each rate limit records a timestamp; after 3+ hits within a window,
 * we estimate the next reset and surface a countdown to the user.
 *
 * State is persisted to disk so it survives DSH restarts.
 */

import { writeTextFile, readTextFile, readTextFileSync } from './fs-cache.ts'

/** A single 429 hit recorded by the tracker. */
interface RateLimitHit {
  /** Unix epoch ms when the 429 was observed. */
  ts: number
  /** One of the error signals we use to classify the limit. */
  kind: 'rate-limit' | 'quota-exhausted' | 'model-unavailable'
}

/** Persisted quota state. */
interface QuotaState {
  /** List of recent 429 hits, most recent first. */
  hits: RateLimitHit[]
  /** ISO timestamp of the most recent reset we estimated. */
  estimatedResetAt?: number
}

const DEFAULT_WINDOW_MS = 10 * 60 * 1000  // 10 minutes
const DEFAULT_RESET_ESTIMATE_MS = 30 * 60 * 1000  // 30 minutes default guess
const HIT_THRESHOLD = 3  // after N hits in window, start showing countdown
const MAX_HITS_TO_KEEP = 20

/** State is persisted to disk so it survives DSH restarts. */
export interface QuotaInfo {
  /** How many 429s we've seen in the last WINDOW_MS. */
  recentHits: number
  /** Whether the quota looks exhausted (hits >= threshold). */
  isExhausted: boolean
  /** Estimated seconds until reset; undefined if not enough data. */
  resetInSeconds?: number
  /** Human-readable note for the UI. */
  note?: string
}

export class QuotaTracker {
  #state: QuotaState = { hits: [] }
  readonly #windowMs: number
  readonly #resetEstimateMs: number
  readonly #threshold: number
  readonly #cachePath: string | undefined
  readonly #now: () => number

  constructor(
    options: {
      windowMs?: number
      resetEstimateMs?: number
      threshold?: number
      cachePath?: string
    } = {},
    now: () => number = Date.now,
  ) {
    this.#windowMs = options.windowMs ?? DEFAULT_WINDOW_MS
    this.#resetEstimateMs = options.resetEstimateMs ?? DEFAULT_RESET_ESTIMATE_MS
    this.#threshold = options.threshold ?? HIT_THRESHOLD
    this.#cachePath = options.cachePath
    this.#now = now
    this.#loadState()
  }

  /**
   * Record a rate-limit response. Call this whenever you see a 429.
   * @param kind - The kind of limit encountered.
   */
  recordRateLimit(kind: RateLimitHit['kind'] = 'rate-limit'): void {
    const hit: RateLimitHit = { ts: this.#now(), kind }
    this.#state.hits.unshift(hit)
    // Keep only recent hits
    this.#state.hits = this.#state.hits.slice(0, MAX_HITS_TO_KEEP)
    // Update estimated reset
    this.#state.estimatedResetAt = this.#estimateReset()
    this.#saveState()
  }

  /**
   * Get current quota status. Safe to call anytime.
   */
  getStatus(): QuotaInfo {
    const now = this.#now()
    const windowStart = now - this.#windowMs
    const recent = this.#state.hits.filter(h => h.ts >= windowStart)
    const count = recent.length
    const isExhausted = count >= this.#threshold
    const resetAt = this.#state.estimatedResetAt ?? (now + this.#resetEstimateMs)
    const resetInSeconds = Math.max(0, Math.round((resetAt - now) / 1000))

    let note: string | undefined
    if (isExhausted) {
      if (resetInSeconds > 0) {
        const mins = Math.ceil(resetInSeconds / 60)
        note = `Free quota rate-limited · resets in ~${mins}m`
      } else {
        note = 'Free quota rate-limited · retry now'
      }
    } else if (count > 0) {
      note = `${count} rate limit${count > 1 ? 's' : ''} in last ${Math.round(this.#windowMs / 60000)}m`
    }

    return {
      recentHits: count,
      isExhausted,
      resetInSeconds: isExhausted ? resetInSeconds : undefined,
      note,
    }
  }

  #estimateReset(): number | undefined {
    const now = this.#now()
    const windowStart = now - this.#windowMs
    const recent = this.#state.hits.filter(h => h.ts >= windowStart)
    if (recent.length < this.#threshold) return undefined
    // Use the oldest hit in the window + estimate
    const oldest = Math.min(...recent.map(h => h.ts))
    return oldest + this.#resetEstimateMs
  }

  #loadState(): void {
    if (!this.#cachePath) return
    const raw = readTextFileSync(this.#cachePath)
    if (!raw) return
    try {
      const parsed = JSON.parse(raw) as QuotaState
      if (parsed && Array.isArray(parsed.hits)) {
        this.#state = parsed
      }
    } catch {
      // Corrupt cache — start fresh
    }
  }

  #saveState(): void {
    if (!this.#cachePath) return
    writeTextFile(this.#cachePath, JSON.stringify(this.#state)).catch(() => {})
  }

  /**
   * Clear all tracked state (call on plugin init or manual reset).
   */
  clear(): void {
    this.#state = { hits: [] }
    if (this.#cachePath) {
      writeTextFile(this.#cachePath, JSON.stringify(this.#state)).catch(() => {})
    }
  }
}

