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
	sources: readonly SourceSetting[]
	theme: Theme
	newTab: boolean
	swipe: SwipeSettings
	blocked: readonly string[]
	favorites: readonly string[]
	descLines: number
	showStatus: boolean
}

export const DESC_MAX = 4

const COOKIE = {
	newTab: 'thenews_newtab',
	sources: 'thenews_sources',
	swipe: 'thenews_swipe',
	theme: 'thenews_theme',
	descLines: 'thenews_desclines',
	showStatus: 'thenews_status',
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

export function parseDescLines(raw: string | undefined): number {
	const value = Number.parseInt(raw ?? '', 10)
	return Number.isInteger(value) && value >= 0 && value <= DESC_MAX ? value : DESC_MAX
}

export function parseShowStatus(raw: string | undefined): boolean {
	return raw !== '0'
}

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
		return []
	}
}

function writeHosts(key: string, hosts: readonly string[]): void {
	try {
		localStorage.setItem(key, JSON.stringify(hosts))
	} catch {}
}

const ASSIGNMENT = '_'
function parseAssignment(token: string): [SwipeSlot, SwipeAction] | undefined {
	const [slot, action] = token.split(ASSIGNMENT)
	const knownSlot = SWIPE_SLOTS.find((known) => known.toLowerCase() === slot)
	const knownAction = SWIPE_ACTIONS.find((known) => known === action)
	return knownSlot && knownAction ? [knownSlot, knownAction] : undefined
}

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
		descLines: parseDescLines(readCookie(COOKIE.descLines)),
		showStatus: parseShowStatus(readCookie(COOKIE.showStatus)),
	}
}

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
	if (patch.descLines !== undefined) writeCookie(COOKIE.descLines, String(current.descLines))
	if (patch.showStatus !== undefined) writeCookie(COOKIE.showStatus, current.showStatus ? '1' : '0')
	if (patch.swipe) writeCookie(COOKIE.swipe, serializeSwipe(current.swipe))
	if (patch.blocked) writeHosts(BLOCKED_KEY, current.blocked)
	if (patch.favorites) writeHosts(FAVORITES_KEY, current.favorites)
	emit()
}

export function isBlocked(host: string): boolean {
	return current.blocked.includes(host)
}

export function setBlocked(host: string, blocked: boolean): void {
	const others = current.blocked.filter((entry) => entry !== host)
	updateSettings({ blocked: blocked ? [...others, host] : others })
}

export function isFavorite(host: string): boolean {
	return current.favorites.includes(host)
}

export function setFavorite(host: string, favorite: boolean): void {
	const others = current.favorites.filter((entry) => entry !== host)
	updateSettings({ favorites: favorite ? [...others, host] : others })
}

function sameSettings(a: Settings, b: Settings): boolean {
	return (
		a.theme === b.theme &&
		a.newTab === b.newTab &&
		a.descLines === b.descLines &&
		a.showStatus === b.showStatus &&
		serializeSwipe(a.swipe) === serializeSwipe(b.swipe) &&
		a.blocked.join() === b.blocked.join() &&
		a.favorites.join() === b.favorites.join() &&
		serializeSources(a.sources) === serializeSources(b.sources)
	)
}

function reload(): void {
	const next = read()
	if (sameSettings(current, next)) return
	current = next
	emit()
}

onCookieChange(COOKIE_NAMES, reload)
addEventListener('storage', (event) => {
	if (event.key === BLOCKED_KEY || event.key === FAVORITES_KEY || event.key === null) reload()
})
