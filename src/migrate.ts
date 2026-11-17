import { readCookie, writeCookieNow } from './cookies'

/**
 * Carries a reader's data over two changes of this project.
 *
 * 1. The app was called tureel. Its cookies and stored keys carried that name.
 * 2. The site moves to a new path when the repository is renamed. Cookies are
 *    tied to the path, so the new path cannot see the old ones. Everything in
 *    `localStorage` belongs to the host and stays readable.
 *
 * So the settings cookies are also kept as a copy in `localStorage`. When the
 * app starts without its cookies, it restores them from that copy. A move to
 * another host starts empty, because nothing is shared between hosts.
 */

const OLD_STORAGE_PREFIX = 'tureel:'
const STORAGE_PREFIX = 'thenews:'
const OLD_COOKIE_PREFIX = 'tureel_'
const COOKIE_PREFIX = 'thenews_'
const BACKUP_KEY = 'thenews:settings:v1'

/** Renames the keys the app stored under its former name. */
function renameStoredKeys(): void {
	const oldKeys = Object.keys(localStorage).filter((key) => key.startsWith(OLD_STORAGE_PREFIX))
	for (const oldKey of oldKeys) {
		const key = STORAGE_PREFIX + oldKey.slice(OLD_STORAGE_PREFIX.length)
		const value = localStorage.getItem(oldKey)
		if (value !== null && localStorage.getItem(key) === null) localStorage.setItem(key, value)
		localStorage.removeItem(oldKey)
	}
}

/** Copies the cookies of the former name to the current names. The old cookies expire on their own. */
function renameCookies(names: readonly string[]): void {
	for (const name of names) {
		const oldName = OLD_COOKIE_PREFIX + name.slice(COOKIE_PREFIX.length)
		const value = readCookie(oldName)
		if (value !== undefined && readCookie(name) === undefined) writeCookieNow(name, value)
	}
}

function readBackup(): Record<string, string> {
	const stored: unknown = JSON.parse(localStorage.getItem(BACKUP_KEY) ?? '{}')
	return stored && typeof stored === 'object' ? (stored as Record<string, string>) : {}
}

/** Writes the cookies back from the copy if the app finds none, as after a change of path. */
function restoreCookies(names: readonly string[]): void {
	if (names.some((name) => readCookie(name) !== undefined)) return
	const backup = readBackup()
	for (const name of names) {
		const value = backup[name]
		if (typeof value === 'string') writeCookieNow(name, value)
	}
}

/** Keeps the copy of the settings cookies up to date. Call after the cookies changed. */
export function backUpCookies(values: Record<string, string>): void {
	try {
		localStorage.setItem(BACKUP_KEY, JSON.stringify(values))
	} catch {
		// Storage is full or blocked. The cookies themselves are unaffected.
	}
}

/** Runs once at startup, before anything reads the settings. */
export function migrate(cookieNames: readonly string[]): void {
	try {
		renameStoredKeys()
		renameCookies(cookieNames)
		restoreCookies(cookieNames)
	} catch {
		// Storage is blocked or holds invalid data. The app starts with what the cookies say.
	}
}
