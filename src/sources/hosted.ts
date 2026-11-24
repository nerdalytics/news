import { isRecent, setGeneratedAt } from '../availability'
import { safeUrl } from '../format'
import { getJson, HttpError, STATUS } from '../net'
import { type FeedItem, LIMIT, type SourceAdapter } from './types'

export function hostedUrl(id: string): string {
	return `https://raw.githubusercontent.com/${__REPOSITORY__}/data-${id}/feed.json`
}

function count(value: unknown, label: unknown): FeedItem['score'] {
	const count = value as { value?: unknown } | undefined
	if (typeof count?.value !== 'number' || typeof label !== 'string') return undefined
	return { label, value: count.value }
}

function copyOptionalFields(item: FeedItem, entry: Record<string, unknown>): void {
	if (typeof entry.description === 'string') item.description = entry.description
	if (typeof entry.tag === 'string') item.tag = entry.tag
	if (typeof entry.time === 'number') item.time = entry.time
	if (typeof entry.rank === 'number') item.rank = entry.rank
}

function toComments(raw: unknown): FeedItem['comments'] {
	const comments = raw as { count?: unknown; url?: unknown; label?: unknown } | undefined
	const url = safeUrl(comments?.url)
	if (!url || typeof comments?.count !== 'number') return undefined
	const label = typeof comments.label === 'string' ? comments.label : 'comment'
	return { count: comments.count, label, url }
}

function toItem(raw: unknown): FeedItem | undefined {
	const entry = raw as Record<string, unknown>
	const url = safeUrl(entry?.url)
	if (!url || typeof entry.title !== 'string' || !entry.title) return undefined
	const item: FeedItem = { id: String(entry.id ?? url), title: entry.title, url }
	copyOptionalFields(item, entry)
	const score = entry.score as { label?: unknown } | undefined
	const parsedScore = count(score, score?.label)
	if (parsedScore) item.score = parsedScore
	const comments = toComments(entry.comments)
	if (comments) item.comments = comments
	return item
}

export class HostedFeedError extends Error {}

export interface HostedFeed {
	generatedAt: number
	items: FeedItem[]
}

export function parse(raw: unknown): HostedFeed {
	const file = raw as { generatedAt?: unknown; items?: unknown }
	if (typeof file?.generatedAt !== 'number' || !Array.isArray(file.items)) {
		throw new HostedFeedError('The feed file has no generation time or no list of entries')
	}
	const items = file.items.flatMap((entry) => toItem(entry) ?? []).slice(0, LIMIT)
	if (items.length === 0) throw new HostedFeedError('The feed file has no usable entries')
	return { generatedAt: file.generatedAt, items }
}

function hasNoFeed(error: unknown): boolean {
	if (error instanceof HostedFeedError) return true
	return error instanceof HttpError && error.status === STATUS.notFound
}

export function hostedAdapter(id: string): SourceAdapter {
	return {
		async fetch(ctx) {
			try {
				const feed = parse(await getJson<unknown>(hostedUrl(id), ctx))
				if (!isRecent(feed.generatedAt)) throw new HostedFeedError('The feed file is too old')
				setGeneratedAt(id, feed.generatedAt)
				return feed.items
			} catch (error) {
				if (hasNoFeed(error)) setGeneratedAt(id, undefined)
				throw error
			}
		},
	}
}
