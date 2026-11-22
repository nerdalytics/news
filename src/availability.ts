import type { SourceMeta } from './sources/types'
import { DAY } from './time'

const KEY = 'thenews:hosted:v1'
export const HOSTED_MAX_AGE_MS = 3 * DAY

type Listener = () => void

let generated: Record<string, number> | undefined
const listeners = new Set<Listener>()

function load(): Record<string, number> {
	try {
		const stored: unknown = JSON.parse(localStorage.getItem(KEY) ?? '{}')
		return stored && typeof stored === 'object' ? (stored as Record<string, number>) : {}
	} catch {
		return {}
	}
}

function save(): void {
	try {
		localStorage.setItem(KEY, JSON.stringify(generated))
	} catch {}
}

export function generatedAt(id: string): number | undefined {
	generated ??= load()
	const value = generated[id]
	return typeof value === 'number' ? value : undefined
}

export function isRecent(time: number, now = Date.now()): boolean {
	return now - time < HOSTED_MAX_AGE_MS
}

export function isAvailable(source: SourceMeta, now = Date.now()): boolean {
	if (!source.hosted) return true
	const time = generatedAt(source.id)
	return time !== undefined && isRecent(time, now)
}

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

export function onAvailabilityChange(listener: Listener): void {
	listeners.add(listener)
}
