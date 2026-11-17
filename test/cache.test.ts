import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isFresh, peek, refresh } from '../src/cache'
import { sourceById } from '../src/sources/index'

const devto = sourceById('devto')!

const ARTICLE = {
	comments_count: 2,
	id: 1,
	public_reactions_count: 3,
	title: 'Cached post',
	url: 'https://dev.to/someone/cached-post',
}

function respondWith(body: unknown): ReturnType<typeof vi.fn> {
	const fetchMock = vi.fn(async () => new Response(JSON.stringify(body)))
	vi.stubGlobal('fetch', fetchMock)
	return fetchMock
}

describe('feed cache', () => {
	beforeEach(() => {
		localStorage.clear()
	})

	afterEach(() => {
		vi.unstubAllGlobals()
	})

	it('shares one request between concurrent callers and stores the result', async () => {
		const fetchMock = respondWith([ARTICLE])
		const [first, second] = await Promise.all([refresh(devto, 'high'), refresh(devto, 'low')])
		expect(fetchMock).toHaveBeenCalledTimes(1)
		expect(first).toBe(second)
		expect(first.items[0]?.title).toBe('Cached post')
		expect(peek('devto')).toBe(first)
		expect(JSON.parse(localStorage.getItem('thenews:feed:v1:devto') ?? '{}').items).toHaveLength(1)
	})

	it('sends requests without credentials and with the given priority', async () => {
		const fetchMock = respondWith([ARTICLE])
		await refresh(devto, 'low')
		const init = fetchMock.mock.calls[0]?.[1] as RequestInit
		expect(init.credentials).toBe('omit')
		expect(init.priority).toBe('low')
	})

	it('rejects on HTTP errors and allows a later retry', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response('nope', { status: 503 }))
		)
		await expect(refresh(devto, 'high')).rejects.toThrow('HTTP 503')
		const fetchMock = respondWith([ARTICLE])
		await refresh(devto, 'high')
		expect(fetchMock).toHaveBeenCalledTimes(1)
	})

	it('judges freshness by the ttl of the source', () => {
		const now = Date.now()
		const ttlMs = devto.ttl * 60_000
		expect(isFresh({ fetchedAt: now - ttlMs + 1000, items: [] }, devto, now)).toBe(true)
		expect(isFresh({ fetchedAt: now - ttlMs - 1000, items: [] }, devto, now)).toBe(false)
	})

	it('ignores stored feeds that are malformed', () => {
		localStorage.setItem('thenews:feed:v1:github', '{"items":"oops"}')
		expect(peek('github')).toBeUndefined()
		localStorage.setItem('thenews:feed:v1:github', 'not json')
		expect(peek('github')).toBeUndefined()
	})

	it('ignores stored feeds older than a week', () => {
		const old = { fetchedAt: Date.now() - 8 * 24 * 60 * 60 * 1000, items: [] }
		localStorage.setItem('thenews:feed:v1:lemmy', JSON.stringify(old))
		expect(peek('lemmy')).toBeUndefined()
	})
})
