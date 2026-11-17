import { isRecent, setGeneratedAt } from '../availability'
import { safeUrl } from '../format'
import { getJson, HttpError, STATUS } from '../net'
import { type FeedItem, LIMIT, type SourceAdapter } from './types'

/**
 * Hosted sources cannot be read from a browser, because they send no CORS
 * header or need a key. A GitHub workflow per source fetches them on a
 * schedule and force-pushes one file, `feed.json`, to the branch
 * `data-<source>`. The app reads that file through raw.githubusercontent.com,
 * which sends `Access-Control-Allow-Origin: *`.
 */
export function hostedUrl(id: string): string {
	return `https://raw.githubusercontent.com/${__REPOSITORY__}/data-${id}/feed.json`
}

function count(value: unknown, label: unknown): FeedItem['score'] {
	const count = value as { value?: unknown } | undefined
	if (typeof count?.value !== 'number' || typeof label !== 'string') return undefined
	return { label, value: count.value }
}

/** The feed file is produced by this project, but it is still checked like any other input. */
function toItem(raw: unknown): FeedItem | undefined {
	const entry = raw as Record<string, unknown>
	const url = safeUrl(entry?.url)
	if (!url || typeof entry.title !== 'string' || !entry.title) return undefined
	const item: FeedItem = { id: String(entry.id ?? url), title: entry.title, url }
	if (typeof entry.description === 'string') item.description = entry.description
	if (typeof entry.tag === 'string') item.tag = entry.tag
	if (typeof entry.time === 'number') item.time = entry.time
	const score = entry.score as { label?: unknown } | undefined
	const parsedScore = count(score, score?.label)
	if (parsedScore) item.score = parsedScore
	const comments = entry.comments as { count?: unknown; url?: unknown; label?: unknown } | undefined
	const discussion = safeUrl(comments?.url)
	if (discussion && typeof comments?.count === 'number') {
		const label = typeof comments.label === 'string' ? comments.label : 'comment'
		item.comments = { count: comments.count, label, url: discussion }
	}
	return item
}

/** The file exists but is not a usable feed. */
export class HostedFeedError extends Error {}

export interface HostedFeed {
	generatedAt: number
	items: FeedItem[]
}

/** Reads a feed file. Throws if it has no generation time or no entries. */
export function parse(raw: unknown): HostedFeed {
	const file = raw as { generatedAt?: unknown; items?: unknown }
	if (typeof file?.generatedAt !== 'number' || !Array.isArray(file.items)) {
		throw new HostedFeedError('The feed file has no generation time or no list of entries')
	}
	const items = file.items.flatMap((entry) => toItem(entry) ?? []).slice(0, LIMIT)
	if (items.length === 0) throw new HostedFeedError('The feed file has no usable entries')
	return { generatedAt: file.generatedAt, items }
}

/** The file is missing until the workflow of the source has succeeded once. */
function hasNoFeed(error: unknown): boolean {
	if (error instanceof HostedFeedError) return true
	return error instanceof HttpError && error.status === STATUS.notFound
}

export function hostedAdapter(id: string): SourceAdapter {
	return {
		async fetch(ctx) {
			try {
				const feed = parse(await getJson<unknown>(hostedUrl(id), ctx))
				// A feed that is too old means the workflow is broken. It is not shown and not cached.
				if (!isRecent(feed.generatedAt)) throw new HostedFeedError('The feed file is too old')
				setGeneratedAt(id, feed.generatedAt)
				return feed.items
			} catch (error) {
				// A network failure says nothing about the feed, so the last known state stays.
				if (hasNoFeed(error)) setGeneratedAt(id, undefined)
				throw error
			}
		},
	}
}
