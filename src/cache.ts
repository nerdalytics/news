import { loadAdapter } from './sources/index'
import type { FeedItem, SourceMeta } from './sources/types'

export interface Feed {
	items: FeedItem[]
	/** Epoch milliseconds. */
	fetchedAt: number
}

const KEY_PREFIX = 'tureel:feed:v1:'
/** Older copies are not shown any more, not even as a placeholder. */
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
		// Storage can be unavailable (private mode, blocked site data) or hold junk.
		return undefined
	}
}

function writeStored(id: string, feed: Feed): void {
	try {
		localStorage.setItem(KEY_PREFIX + id, JSON.stringify(feed))
	} catch {
		// Quota exceeded or storage blocked: the in-memory copy still serves this visit.
	}
}

/** The last known feed of a source, without touching the network. */
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
	const adapter = await loadAdapter(source.id)
	const feed: Feed = { fetchedAt: Date.now(), items: await adapter.fetch({ priority }) }
	memory.set(source.id, feed)
	writeStored(source.id, feed)
	return feed
}

/** Fetches a source; concurrent calls for the same source share one request. */
export function refresh(source: SourceMeta, priority: RequestPriority): Promise<Feed> {
	const pending = inflight.get(source.id)
	if (pending) return pending
	const request = fetchFeed(source, priority).finally(() => inflight.delete(source.id))
	inflight.set(source.id, request)
	return request
}
