import { deleteCookie } from './cookies'
import { COOKIE_NAMES } from './settings'

/** Every `localStorage` key of the app starts with this. */
const STORAGE_PREFIX = 'tureel:'

function clearStorage(): void {
	try {
		const keys = Object.keys(localStorage).filter((key) => key.startsWith(STORAGE_PREFIX))
		for (const key of keys) localStorage.removeItem(key)
	} catch {
		// Storage is blocked, so there is nothing to remove.
	}
}

/**
 * Deletes the settings cookies, the blocked sites, the opened links and the
 * cached feeds, then reloads. The reader sees the first-run screen again.
 */
export async function startFresh(): Promise<void> {
	await Promise.all(COOKIE_NAMES.map(deleteCookie))
	clearStorage()
	// Reload without the fragment and without `?debug`.
	location.replace(location.pathname)
}
