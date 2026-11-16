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
 * Tracks which entries the reader opened or marked as read. The app does not
 * use the browser's `:visited` state. That state misses links opened from a
 * home screen web app or a private window, and a script cannot clear it when
 * the reader marks an entry as unread.
 */
export function isRead(url: string): boolean {
	urls ??= load()
	return urls.has(url)
}

export function markUnread(url: string): void {
	urls ??= load()
	if (urls.delete(url)) save(urls)
}

export function markRead(url: string): void {
	urls ??= load()
	// Re-adding moves the URL to the end, so the oldest entries drop out first.
	urls.delete(url)
	urls.add(url)
	urls = new Set([...urls].slice(-MAX_ENTRIES))
	save(urls)
}
