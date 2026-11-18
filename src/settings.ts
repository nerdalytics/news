import { onCookieChange, readCookie, writeCookie } from './cookies'
import { SOURCES } from './sources/index'
import type { SourceMeta } from './sources/types'
import {
	SWIPE_ACTIONS,
	SWIPE_SLOTS,
	type SwipeAction,
	type SwipeSettings,
	type SwipeSlot,
} from './ui/gestures'

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
	/** The action assigned to each swipe on an entry. No swipe has an action by default. */
	swipe: SwipeSettings
	/**
	 * Hosts of linked sites the reader blocked, oldest first. This list is kept
	 * in `localStorage`, because it can outgrow the 4096 bytes of a cookie.
	 */
	blocked: readonly string[]
	/** Hosts of linked sites the reader favorited. Their entries are highlighted. */
	favorites: readonly string[]
}

const COOKIE = {
	newTab: 'thenews_newtab',
	sources: 'thenews_sources',
	swipe: 'thenews_swipe',
	theme: 'thenews_theme',
}
export const COOKIE_NAMES: readonly string[] = Object.values(COOKIE)
const BLOCKED_KEY = 'thenews:blocked:v1'
const FAVORITES_KEY = 'thenews:favorites:v1'
const DISABLED_PREFIX = '-'
const SEPARATOR = '.'
const HOST_PATTERN = /^[a-z0-9.-]+$/

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

/** Accepts a stored list and keeps the entries that are host names, without duplicates. */
function parseHosts(stored: unknown): string[] {
	if (!Array.isArray(stored)) return []
	const hosts = stored.filter((host) => typeof host === 'string' && HOST_PATTERN.test(host))
	return [...new Set(hosts)]
}

export function parseBlocked(stored: unknown): string[] {
	return parseHosts(stored)
}

export function parseFavorites(stored: unknown): string[] {
	return parseHosts(stored)
}

function readHosts(key: string): string[] {
	try {
		return parseHosts(JSON.parse(localStorage.getItem(key) ?? '[]'))
	} catch {
		// Storage can be blocked, and stored data can be invalid. Start with an empty list.
		return []
	}
}

function writeHosts(key: string, hosts: readonly string[]): void {
	try {
		localStorage.setItem(key, JSON.stringify(hosts))
	} catch {
		// Writing fails when storage is full or blocked. The list still applies to this visit.
	}
}

/** Joins a swipe and its action inside the cookie, as in `left_read`. */
const ASSIGNMENT = '_'
function parseAssignment(token: string): [SwipeSlot, SwipeAction] | undefined {
	const [slot, action] = token.split(ASSIGNMENT)
	const knownSlot = SWIPE_SLOTS.find((known) => known.toLowerCase() === slot)
	const knownAction = SWIPE_ACTIONS.find((known) => known === action)
	return knownSlot && knownAction ? [knownSlot, knownAction] : undefined
}

/**
 * The cookie lists the swipes that have an action, joined by `.`, as in
 * `left_read.leftlong_hide.right_unread`. Unknown swipes and actions are dropped.
 */
export function parseSwipe(raw: string | undefined): SwipeSettings {
	const swipe: SwipeSettings = {}
	for (const token of (raw ?? '').split(SEPARATOR)) {
		const assignment = parseAssignment(token)
		if (assignment) swipe[assignment[0]] = assignment[1]
	}
	return swipe
}

export function serializeSwipe(swipe: SwipeSettings): string {
	return SWIPE_SLOTS.flatMap((slot) => {
		const action = swipe[slot]
		return action ? [`${slot.toLowerCase()}${ASSIGNMENT}${action}`] : []
	}).join(SEPARATOR)
}

/** Keeps the entries the list in the settings does not show, such as hosted sources without a feed. */
export function withHiddenSources(visible: readonly SourceSetting[]): SourceSetting[] {
	const shown = new Set(visible.map((source) => source.id))
	return [...visible, ...current.sources.filter((source) => !shown.has(source.id))]
}

function read(): Settings {
	return {
		blocked: readHosts(BLOCKED_KEY),
		favorites: readHosts(FAVORITES_KEY),
		newTab: readCookie(COOKIE.newTab) === '1',
		sources: parseSources(readCookie(COOKIE.sources)),
		swipe: parseSwipe(readCookie(COOKIE.swipe)),
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
	if (patch.swipe) writeCookie(COOKIE.swipe, serializeSwipe(current.swipe))
	if (patch.blocked) writeHosts(BLOCKED_KEY, current.blocked)
	if (patch.favorites) writeHosts(FAVORITES_KEY, current.favorites)
	emit()
}

export function isBlocked(host: string): boolean {
	return current.blocked.includes(host)
}

/** Blocks or unblocks the host of a linked site. */
export function setBlocked(host: string, blocked: boolean): void {
	const others = current.blocked.filter((entry) => entry !== host)
	updateSettings({ blocked: blocked ? [...others, host] : others })
}

export function isFavorite(host: string): boolean {
	return current.favorites.includes(host)
}

/** Favorites or unfavorites the host of a linked site. */
export function setFavorite(host: string, favorite: boolean): void {
	const others = current.favorites.filter((entry) => entry !== host)
	updateSettings({ favorites: favorite ? [...others, host] : others })
}

function sameSettings(a: Settings, b: Settings): boolean {
	return (
		a.theme === b.theme &&
		a.newTab === b.newTab &&
		serializeSwipe(a.swipe) === serializeSwipe(b.swipe) &&
		a.blocked.join() === b.blocked.join() &&
		a.favorites.join() === b.favorites.join() &&
		serializeSources(a.sources) === serializeSources(b.sources)
	)
}

/** Applies settings that another tab changed. */
function reload(): void {
	const next = read()
	if (sameSettings(current, next)) return
	current = next
	emit()
}

onCookieChange(COOKIE_NAMES, reload)
// The `storage` event fires in the other tabs of this site, not in the one that wrote.
addEventListener('storage', (event) => {
	if (event.key === BLOCKED_KEY || event.key === FAVORITES_KEY || event.key === null) reload()
})
