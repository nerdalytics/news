import { DAY, SECOND } from './time'

const MAX_AGE_MS = 400 * DAY
const MAX_AGE_SECONDS = MAX_AGE_MS / SECOND

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
		} catch {}
	}
	return cookies
}

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
			expires: Date.now() + MAX_AGE_MS,
			name,
			path: cookiePath(),
			sameSite: 'lax',
			value: encodeURIComponent(value),
		})
		.catch(() => writeLegacy(name, value))
}

function deleteLegacy(name: string): void {
	// biome-ignore lint/suspicious/noDocumentCookie: fallback for browsers without the Cookie Store API
	document.cookie = `${name}=; Max-Age=0; Path=${cookiePath()}`
}

export async function deleteCookie(name: string): Promise<void> {
	if (!('cookieStore' in window)) {
		deleteLegacy(name)
		return
	}
	await cookieStore.delete({ name, path: cookiePath() }).catch(() => deleteLegacy(name))
}

export function onCookieChange(names: readonly string[], callback: () => void): void {
	if (!('cookieStore' in window)) return
	cookieStore.addEventListener('change', (event) => {
		const touched = [...event.changed, ...event.deleted]
		if (touched.some((cookie) => cookie.name && names.includes(cookie.name))) callback()
	})
}
