/**
 * File-based cache helpers for the catalog and quota tracker.
 *
 * Uses Node's built-in fs module. On browsers (dsh web) these are no-ops — callers
 * check cachePath before invoking anything here.
 */

import { mkdir, writeFile, readFile, promises as fs } from 'node:fs'
import { dirname } from 'node:path'

/**
 * Write text content to a file, creating parent directories as needed.
 * Returns true on success, false on failure (best-effort).
 */
export async function writeTextFile(path: string, content: string): Promise<boolean> {
  try {
    const dir = dirname(path)
    await mkdir(dir, { recursive: true })
    await writeFile(path, content, 'utf8')
    return true
  } catch {
    return false
  }
}

/**
 * Read text content from a file. Returns undefined on failure.
 */
export async function readTextFile(path: string): Promise<string | undefined> {
  try {
    const content = await readFile(path, 'utf8')
    return content
  } catch {
    return undefined
  }
}

/**
 * Synchronous read for use during synchronous initialization.
 * Returns undefined on any failure.
 */
export function readTextFileSync(path: string): string | undefined {
  try {
    const { readFileSync } = require('node:fs') as typeof import('node:fs')
    return readFileSync(path, 'utf8') as string
  } catch {
    return undefined
  }
}

