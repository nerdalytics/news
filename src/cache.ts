import { adapterFor } from './sources/index'
import type { FeedItem, SourceMeta } from './sources/types'
import { DAY, MINUTE } from './time'

export interface Feed {
	items: FeedItem[]
	fetchedAt: number
}

const KEY_PREFIX = 'thenews:feed:v1:'
const MAX_AGE_MS = 7 * DAY

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
		return undefined
	}
}

function writeStored(id: string, feed: Feed): void {
	try {
		localStorage.setItem(KEY_PREFIX + id, JSON.stringify(feed))
	} catch {}
}

export function peek(id: string, now = Date.now()): Feed | undefined {
	const feed = memory.get(id) ?? readStored(id)
	if (!feed || now - feed.fetchedAt > MAX_AGE_MS) return undefined
	memory.set(id, feed)
	return feed
}

export function isFresh(feed: Feed, source: SourceMeta, now = Date.now()): boolean {
	return now - feed.fetchedAt < source.ttl * MINUTE
}

async function fetchFeed(source: SourceMeta, priority: RequestPriority): Promise<Feed> {
	const items = await adapterFor(source.id).fetch({ priority })
	const feed: Feed = { fetchedAt: Date.now(), items }
	memory.set(source.id, feed)
	writeStored(source.id, feed)
	return feed
}

function report(id: string, startedAt: number, error?: unknown): void {
	const detail = {
		id,
		ms: Math.round(performance.now() - startedAt),
		...(error ? { error: String(error) } : {}),
	}
	dispatchEvent(new CustomEvent('thenews:fetch', { detail }))
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

export function refresh(source: SourceMeta, priority: RequestPriority): Promise<Feed> {
	const pending = inflight.get(source.id)
	if (pending) return pending
	const request = timedFetch(source, priority).finally(() => inflight.delete(source.id))
	inflight.set(source.id, request)
	return request
}
