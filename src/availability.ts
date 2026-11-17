import type { SourceMeta } from './sources/types'
import { DAY } from './time'

/**
 * Tracks which hosted sources have a usable feed.
 *
 * A hosted source is fetched by its own GitHub workflow, which publishes a
 * feed file. The app lists such a source only after it has read a feed that is
 * recent enough. A source whose workflow never ran, or has failed for longer
 * than the limit below, is hidden from the tabs and from the settings.
 */

const KEY = 'thenews:hosted:v1'
/** A workflow that has not published for this long counts as broken. */
export const HOSTED_MAX_AGE_MS = 3 * DAY

type Listener = () => void

/** When each hosted feed was generated, in epoch milliseconds. */
let generated: Record<string, number> | undefined
const listeners = new Set<Listener>()

function load(): Record<string, number> {
	try {
		const stored: unknown = JSON.parse(localStorage.getItem(KEY) ?? '{}')
		return stored && typeof stored === 'object' ? (stored as Record<string, number>) : {}
	} catch {
		// Storage can be blocked, and stored data can be invalid. Start with nothing known.
		return {}
	}
}

function save(): void {
	try {
		localStorage.setItem(KEY, JSON.stringify(generated))
	} catch {
		// Writing fails when storage is full or blocked. The state still applies to this visit.
	}
}

/** When the feed of a hosted source was generated, if the app has read one. */
export function generatedAt(id: string): number | undefined {
	generated ??= load()
	const value = generated[id]
	return typeof value === 'number' ? value : undefined
}

export function isRecent(time: number, now = Date.now()): boolean {
	return now - time < HOSTED_MAX_AGE_MS
}

/** Direct sources are always available. Hosted ones need a recent feed. */
export function isAvailable(source: SourceMeta, now = Date.now()): boolean {
	if (!source.hosted) return true
	const time = generatedAt(source.id)
	return time !== undefined && isRecent(time, now)
}

/** Records the outcome of reading a hosted feed. `undefined` means there is no usable feed. */
export function setGeneratedAt(id: string, time: number | undefined): void {
	generated ??= load()
	if (generated[id] === time) return
	const before = isKnownAvailable(id)
	if (time === undefined) delete generated[id]
	else generated[id] = time
	save()
	if (before !== isKnownAvailable(id)) for (const listener of listeners) listener()
}

function isKnownAvailable(id: string): boolean {
	const time = generatedAt(id)
	return time !== undefined && isRecent(time)
}

/** Calls back when a hosted source appears or disappears. */
export function onAvailabilityChange(listener: Listener): void {
	listeners.add(listener)
}
