/** Chrome caps cookie lifetime at 400 days; other browsers accept it too. */
const MAX_AGE_SECONDS = 400 * 24 * 60 * 60

/** The directory the app is served from, e.g. `/tureel/` on GitHub Pages. */
function cookiePath(): string {
	return new URL('.', document.baseURI).pathname
}

export function parseCookies(header: string): Map<string, string> {
	const cookies = new Map<string, string>()
	for (const pair of header.split('; ')) {
		const split = pair.indexOf('=')
		if (split < 1) continue
		try {
			cookies.set(pair.slice(0, split), decodeURIComponent(pair.slice(split + 1)))
		} catch {
			// A malformed value from elsewhere on this origin is not ours to fix.
		}
	}
	return cookies
}

/** Synchronous on purpose: settings are needed before the first paint. */
export function readCookie(name: string): string | undefined {
	return parseCookies(document.cookie).get(name)
}

function writeLegacy(name: string, value: string): void {
	const secure = location.protocol === 'https:' ? '; Secure' : ''
	// biome-ignore lint/suspicious/noDocumentCookie: fallback for browsers without the Cookie Store API
	document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${MAX_AGE_SECONDS}; Path=${cookiePath()}; SameSite=Lax${secure}`
}

export function writeCookie(name: string, value: string): void {
	if (!('cookieStore' in window)) {
		writeLegacy(name, value)
		return
	}
	cookieStore
		.set({
			expires: Date.now() + MAX_AGE_SECONDS * 1000,
			name,
			path: cookiePath(),
			sameSite: 'lax',
			value: encodeURIComponent(value),
		})
		.catch(() => writeLegacy(name, value))
}

/** Calls back when another tab changes one of the named cookies. */
export function onCookieChange(names: readonly string[], callback: () => void): void {
	if (!('cookieStore' in window)) return
	cookieStore.addEventListener('change', (event) => {
		const touched = [...event.changed, ...event.deleted]
		if (touched.some((cookie) => cookie.name && names.includes(cookie.name))) callback()
	})
}
