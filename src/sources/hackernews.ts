import { safeUrl } from '../format'
import { getJson, preconnect } from '../net'
import { type FeedItem, LIMIT, type SourceAdapter } from './types'

/**
 * Two requests in total: the official Firebase API gives the front page order,
 * the Algolia HN Search API resolves all stories in one batch instead of one
 * request per story.
 */
const TOP_URL = 'https://hacker-news.firebaseio.com/v0/topstories.json'
const SEARCH_URL = 'https://hn.algolia.com/api/v1/search'
/** Ask for a few more than needed: job posts and just-submitted stories are not in the index. */
const CANDIDATES = 30

interface Hit {
	objectID: string
	title?: string | null
	url?: string | null
	points?: number | null
	num_comments?: number | null
	created_at_i?: number
}

export interface SearchResponse {
	hits: Hit[]
}

export function searchUrl(ids: readonly number[]): string {
	const params = new URLSearchParams({
		attributesToHighlight: '[]',
		attributesToRetrieve: 'title,url,points,num_comments,created_at_i',
		hitsPerPage: String(ids.length),
		tags: `(story,poll),(${ids.map((id) => `story_${id}`).join(',')})`,
	})
	return `${SEARCH_URL}?${params}`
}

function toItem(hit: Hit): FeedItem | undefined {
	if (!hit.title) return undefined
	const discussion = `https://news.ycombinator.com/item?id=${hit.objectID}`
	const item: FeedItem = {
		id: hit.objectID,
		title: hit.title,
		// Ask HN and other text posts have no URL: the discussion is the item.
		url: safeUrl(hit.url) ?? discussion,
		comments: { count: hit.num_comments ?? 0, label: 'comment', url: discussion },
		score: { label: 'point', value: hit.points ?? 0 },
	}
	if (hit.created_at_i) item.time = hit.created_at_i * 1000
	return item
}

/** Puts the search hits back into front page order. */
export function parse(ids: readonly number[], response: SearchResponse): FeedItem[] {
	const byId = new Map(response.hits.map((hit) => [hit.objectID, hit]))
	const items: FeedItem[] = []
	for (const id of ids) {
		const hit = byId.get(String(id))
		const item = hit && toItem(hit)
		if (item) items.push(item)
	}
	return items.slice(0, LIMIT)
}

const adapter: SourceAdapter = {
	async fetch(ctx) {
		// The second request can only start after the first: have its connection ready.
		preconnect(new URL(SEARCH_URL).origin)
		const top = await getJson<number[]>(TOP_URL, ctx)
		const ids = top.slice(0, CANDIDATES)
		return parse(ids, await getJson<SearchResponse>(searchUrl(ids), ctx))
	},
}

export default adapter
