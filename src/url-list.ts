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
			return new Set()
		}
	}

	const save = (entries: Set<string>): void => {
		try {
			localStorage.setItem(key, JSON.stringify([...entries]))
		} catch {}
	}

	const current = (): Set<string> => {
		urls ??= load()
		return urls
	}

	return {
		add(url) {
			const entries = current()
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
