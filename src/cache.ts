import { adapterFor } from './sources/index'
import type { FeedItem, SourceMeta } from './sources/types'

export interface Feed {
	items: FeedItem[]
	/** Epoch milliseconds. */
	fetchedAt: number
}

const KEY_PREFIX = 'tureel:feed:v1:'
/** The app discards cached feeds older than this. */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

const memory = new Map<string, Feed>()
const inflight = new Map<string, Promise<Feed>>()

function isFeed(value: unknown): value is Feed {
	const feed = value as Feed | null
	return typeof feed?.fetchedAt === 'number' && Array.isArray(feed.items)
}

function readStored(id: string): Feed | undefined {
	try {
		const feed: unknown = JSON.parse(localStorage.getItem(KEY_PREFIX + id) ?? 'null')
		return isFeed(feed) ? feed : undefined
	} catch {
		// Storage can be blocked, for example in private mode, and stored data can be invalid.
		return undefined
	}
}

function writeStored(id: string, feed: Feed): void {
	try {
		localStorage.setItem(KEY_PREFIX + id, JSON.stringify(feed))
	} catch {
		// Writing fails when storage is full or blocked. The in-memory copy still serves this visit.
	}
}

/** Returns the cached feed of a source without a network request. */
export function peek(id: string, now = Date.now()): Feed | undefined {
	const feed = memory.get(id) ?? readStored(id)
	if (!feed || now - feed.fetchedAt > MAX_AGE_MS) return undefined
	memory.set(id, feed)
	return feed
}

export function isFresh(feed: Feed, source: SourceMeta, now = Date.now()): boolean {
	return now - feed.fetchedAt < source.ttl * 60_000
}

async function fetchFeed(source: SourceMeta, priority: RequestPriority): Promise<Feed> {
	const items = await adapterFor(source.id).fetch({ priority })
	const feed: Feed = { fetchedAt: Date.now(), items }
	memory.set(source.id, feed)
	writeStored(source.id, feed)
	return feed
}

/** Reports the outcome of a fetch to the `?debug` panel. Nothing listens otherwise. */
function report(id: string, startedAt: number, error?: unknown): void {
	const detail = {
		id,
		ms: Math.round(performance.now() - startedAt),
		...(error ? { error: String(error) } : {}),
	}
	dispatchEvent(new CustomEvent('tureel:fetch', { detail }))
}

async function timedFetch(source: SourceMeta, priority: RequestPriority): Promise<Feed> {
	const startedAt = performance.now()
	try {
		const feed = await fetchFeed(source, priority)
		report(source.id, startedAt)
		return feed
	} catch (error) {
		report(source.id, startedAt, error)
		throw error
	}
}

/** Fetches a source. Concurrent calls for the same source share one request. */
export function refresh(source: SourceMeta, priority: RequestPriority): Promise<Feed> {
	const pending = inflight.get(source.id)
	if (pending) return pending
	const request = timedFetch(source, priority).finally(() => inflight.delete(source.id))
	inflight.set(source.id, request)
	return request
}
