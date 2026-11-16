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
	/** Hosts of linked sites the reader blocked, oldest first. */
	blocked: readonly string[]
}

const COOKIE = {
	blocked: 'tureel_blocked',
	newTab: 'tureel_newtab',
	sources: 'tureel_sources',
	theme: 'tureel_theme',
}
const DISABLED_PREFIX = '-'
const SEPARATOR = '.'
/** `~` cannot occur in a host name and needs no encoding in a cookie. */
const HOST_SEPARATOR = '~'
/** Keeps the cookie well below the 4096 byte limit. */
const MAX_BLOCKED = 100

function allOff(catalogue: readonly SourceMeta[]): SourceSetting[] {
	return catalogue.map((source) => ({ enabled: false, id: source.id }))
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
	if (raw === undefined) return allOff(catalogue)
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

export function parseBlocked(raw: string | undefined): string[] {
	const hosts = (raw ?? '').split(HOST_SEPARATOR).filter((host) => /^[a-z0-9.-]+$/.test(host))
	return [...new Set(hosts)]
}

/** Keeps the most recent hosts when the list grows beyond the limit. */
export function serializeBlocked(hosts: readonly string[]): string {
	return hosts.slice(-MAX_BLOCKED).join(HOST_SEPARATOR)
}

function read(): Settings {
	return {
		blocked: parseBlocked(readCookie(COOKIE.blocked)),
		newTab: readCookie(COOKIE.newTab) === '1',
		sources: parseSources(readCookie(COOKIE.sources)),
		theme: parseTheme(readCookie(COOKIE.theme)),
	}
}

/** True until the reader has chosen sources once, which creates the sources cookie. */
export function isFirstVisit(): boolean {
	return readCookie(COOKIE.sources) === undefined
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
	if (patch.blocked) writeCookie(COOKIE.blocked, serializeBlocked(current.blocked))
	emit()
}

export function isBlocked(host: string): boolean {
	return current.blocked.includes(host)
}

/** Blocks or unblocks the host of a linked site. */
export function setBlocked(host: string, blocked: boolean): void {
	const others = current.blocked.filter((entry) => entry !== host)
	updateSettings({ blocked: (blocked ? [...others, host] : others).slice(-MAX_BLOCKED) })
}

function sameSettings(a: Settings, b: Settings): boolean {
	return (
		a.theme === b.theme &&
		a.newTab === b.newTab &&
		serializeBlocked(a.blocked) === serializeBlocked(b.blocked) &&
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
