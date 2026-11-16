import { onCookieChange, readCookie, writeCookie } from './cookies'
import { SOURCES } from './sources/index'
import type { SourceMeta } from './sources/types'

export type Theme = 'auto' | 'light' | 'dark'

export interface SourceSetting {
	id: string
	enabled: boolean
}

export interface Settings {
	/** Every source of the catalogue, in the reader's order. */
	sources: readonly SourceSetting[]
	theme: Theme
	newTab: boolean
}

const COOKIE = { newTab: 'tureel_newtab', sources: 'tureel_sources', theme: 'tureel_theme' }
const DISABLED_PREFIX = '-'
const SEPARATOR = '.'

function defaults(catalogue: readonly SourceMeta[]): SourceSetting[] {
	return catalogue.map((source) => ({ enabled: source.enabledByDefault, id: source.id }))
}

/**
 * The cookie lists ids in display order, joined by `.`. A `-` prefix marks a
 * disabled source, as in `hn.github.-devto`. The parser drops ids that are no
 * longer in the catalogue. It appends catalogue sources that the cookie does not
 * mention and switches them off.
 */
export function parseSources(
	raw: string | undefined,
	catalogue: readonly SourceMeta[] = SOURCES
): SourceSetting[] {
	if (raw === undefined) return defaults(catalogue)
	const known = new Set(catalogue.map((source) => source.id))
	const sources: SourceSetting[] = []
	for (const token of raw.split(SEPARATOR)) {
		const enabled = !token.startsWith(DISABLED_PREFIX)
		const id = enabled ? token : token.slice(DISABLED_PREFIX.length)
		if (known.delete(id)) sources.push({ enabled, id })
	}
	for (const id of known) sources.push({ enabled: false, id })
	return sources
}

export function serializeSources(sources: readonly SourceSetting[]): string {
	return sources
		.map((source) => (source.enabled ? source.id : DISABLED_PREFIX + source.id))
		.join(SEPARATOR)
}

export function parseTheme(raw: string | undefined): Theme {
	return raw === 'light' || raw === 'dark' ? raw : 'auto'
}

function read(): Settings {
	return {
		newTab: readCookie(COOKIE.newTab) === '1',
		sources: parseSources(readCookie(COOKIE.sources)),
		theme: parseTheme(readCookie(COOKIE.theme)),
	}
}

type Listener = (settings: Settings) => void

let current = read()
const listeners = new Set<Listener>()

function emit(): void {
	for (const listener of listeners) listener(current)
}

export function getSettings(): Settings {
	return current
}

export function enabledIds(settings: Settings = current): string[] {
	return settings.sources.filter((source) => source.enabled).map((source) => source.id)
}

export function subscribe(listener: Listener): void {
	listeners.add(listener)
}

export function updateSettings(patch: Partial<Settings>): void {
	current = { ...current, ...patch }
	if (patch.sources) writeCookie(COOKIE.sources, serializeSources(current.sources))
	if (patch.theme) writeCookie(COOKIE.theme, current.theme)
	if (patch.newTab !== undefined) writeCookie(COOKIE.newTab, current.newTab ? '1' : '0')
	emit()
}

function sameSettings(a: Settings, b: Settings): boolean {
	return (
		a.theme === b.theme &&
		a.newTab === b.newTab &&
		serializeSources(a.sources) === serializeSources(b.sources)
	)
}

// Apply settings that another tab changed.
onCookieChange(Object.values(COOKIE), () => {
	const next = read()
	if (sameSettings(current, next)) return
	current = next
	emit()
})
