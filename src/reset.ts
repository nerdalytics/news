import { deleteCookie } from './cookies'
import { COOKIE_NAMES } from './settings'

const STORAGE_PREFIX = 'thenews:'

function clearStorage(): void {
	try {
		const keys = Object.keys(localStorage).filter((key) => key.startsWith(STORAGE_PREFIX))
		for (const key of keys) localStorage.removeItem(key)
	} catch {}
}

export async function startFresh(): Promise<void> {
	await Promise.all(COOKIE_NAMES.map(deleteCookie))
	clearStorage()
	location.replace(location.pathname)
}
