/**
 * Bundled snapshot: the fallback list used when the upstream catalog is unreachable.
 *
 * **The normal path never reads this.** `discovery.ts` fetches free models live from
 * models.dev + Zen, because Zen states they are "time-limited, for vendor feedback" —
 * any hardcoded list is guaranteed to go stale. This snapshot only steps in when the
 * network is down or models.dev misbehaves, so an offline machine still sees a list
 * instead of nothing.
 *
 * Values verified against live Zen `/v1/models` and models.dev as of 2026-08-30.
 * Only models confirmed present on BOTH sources are included.
 */

/** A catalog entry: model id plus display and capacity info. */
export interface ZenModel {
  /** The `model` field sent to `/chat/completions`. */
  readonly id: string
  /** Name shown in the model picker. */
  readonly name: string
  /** One line to tell similar models apart. */
  readonly description: string
  /** Context limit for request plus response, in tokens. */
  readonly contextWindow: number
  /** Output cap for a single response, in tokens. */
  readonly maxOutputTokens: number
}

/**
 * Free models confirmed available on both models.dev (cost=0) and Zen /v1/models.
 * Sorted by context window descending. Updated 2026-08-30.
 *
 * Note: Zen's free model roster is time-limited. When the live catalog is reachable,
 * this snapshot is only a fallback — always prefer `discovery.ts` results.
 */
export const FALLBACK_MODELS: readonly ZenModel[] = [
  {
    id: 'nemotron-3-ultra-free',
    name: 'Nemotron 3 Ultra (free)',
    description: '1M context — the pick for reading a whole repository',
    contextWindow: 1_000_000,
    maxOutputTokens: 128_000,
  },
  {
    id: 'nemotron-3.5-lightning-free',
    name: 'Nemotron 3.5 Lightning (free)',
    description: 'Output cap as large as the context — suits long-form generation',
    contextWindow: 262_144,
    maxOutputTokens: 262_144,
  },
  {
    id: 'laguna-s-2.1-free',
    name: 'Laguna S 2.1 (free)',
    description: 'A 256K-context generalist',
    contextWindow: 256_000,
    maxOutputTokens: 32_000,
  },
  {
    id: 'deepseek-v4-flash-free',
    name: 'DeepSeek V4 Flash (free)',
    description: 'DeepSeek, same lineage as the harness; 128K output',
    contextWindow: 200_000,
    maxOutputTokens: 128_000,
  },
  {
    id: 'big-pickle',
    name: 'Big Pickle (free)',
    description: "Zen's own anonymous evaluation model",
    contextWindow: 200_000,
    maxOutputTokens: 32_000,
  },
  {
    id: 'mimo-v2.5-free',
    name: 'MiMo v2.5 (free)',
    description: 'A lightweight 200K-context model',
    contextWindow: 200_000,
    maxOutputTokens: 32_000,
  },
  {
    id: 'muse-spark-1.2-contributor-free',
    name: 'Muse Spark 1.2 Contributor (free)',
    description: '1M context — contributor-tier access, great for long documents',
    contextWindow: 1_048_576,
    maxOutputTokens: 131_072,
  },
  {
    id: 'ling-3.0-flash-fin-free',
    name: 'Ling 3.0 Flash Fin (free)',
    description: '262K context, financial-specialized variant',
    contextWindow: 262_144,
    maxOutputTokens: 32_768,
  },
]

/**
 * Find an entry by id in a catalog.
 * @param models - The current catalog (live or snapshot).
 * @param id - Model id.
 * @returns The matching entry, or undefined if absent — which does not mean
 *          unavailable; see the module comment.
 */
export function findModel(models: readonly ZenModel[], id: string): ZenModel | undefined {
  return models.find(model => model.id === id)
}
