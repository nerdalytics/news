/**
 * A list of URLs in `localStorage` that keeps the most recent entries. The
 * read marks and the hidden entries are two such lists.
 */
export interface UrlList {
	has(url: string): boolean
	add(url: string): void
	delete(url: string): void
	clear(): void
	size(): number
}

export function createUrlList(key: string, maxEntries: number): UrlList {
	let urls: Set<string> | undefined

	const load = (): Set<string> => {
		try {
			const stored: unknown = JSON.parse(localStorage.getItem(key) ?? '[]')
			return new Set(Array.isArray(stored) ? stored.filter((url) => typeof url === 'string') : [])
		} catch {
			// Storage can be blocked, and stored data can be invalid. Start with an empty list.
			return new Set()
		}
	}

	const save = (entries: Set<string>): void => {
		try {
			localStorage.setItem(key, JSON.stringify([...entries]))
		} catch {
			// Writing fails when storage is full or blocked. The list still serves this visit.
		}
	}

	const current = (): Set<string> => {
		urls ??= load()
		return urls
	}

	return {
		add(url) {
			const entries = current()
			// Re-adding moves the URL to the end, so the oldest entries drop out first.
			entries.delete(url)
			entries.add(url)
			urls = new Set([...entries].slice(-maxEntries))
			save(urls)
		},
		clear() {
			urls = new Set()
			save(urls)
		},
		delete(url) {
			if (current().delete(url)) save(current())
		},
		has: (url) => current().has(url),
		size: () => current().size,
	}
}
