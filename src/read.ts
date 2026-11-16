const KEY = 'tureel:read:v1'
/** The list keeps the most recently opened links. */
const MAX_ENTRIES = 500

let urls: Set<string> | undefined

function load(): Set<string> {
	try {
		const stored: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]')
		return new Set(Array.isArray(stored) ? stored.filter((url) => typeof url === 'string') : [])
	} catch {
		// Storage can be blocked, and stored data can be invalid. Start with an empty list.
		return new Set()
	}
}

function save(entries: Set<string>): void {
	try {
		localStorage.setItem(KEY, JSON.stringify([...entries]))
	} catch {
		// Writing fails when storage is full or blocked. The list still serves this visit.
	}
}

/**
 * Tracks which links the reader opened from tureel. The browser's own
 * `:visited` state is not enough. A web app on the home screen opens links in
 * a separate browser view, and private windows keep no history.
 */
export function isRead(url: string): boolean {
	urls ??= load()
	return urls.has(url)
}

export function markRead(url: string): void {
	urls ??= load()
	// Re-adding moves the URL to the end, so the oldest entries drop out first.
	urls.delete(url)
	urls.add(url)
	urls = new Set([...urls].slice(-MAX_ENTRIES))
	save(urls)
}
