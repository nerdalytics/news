import { safeUrl } from '../format'
import { getJson } from '../net'
import { SECOND } from '../time'
import { type FeedItem, LIMIT, type SourceAdapter } from './types'

const TOP_URL = 'https://hacker-news.firebaseio.com/v0/topstories.json'
const SEARCH_URL = 'https://hn.algolia.com/api/v1/search'
const FIELDS = 'title,url,points,num_comments,created_at_i'
const CANDIDATES = 30
const FRONT_PAGE_HITS = 50

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

export function frontPageUrl(): string {
	const params = new URLSearchParams({
		attributesToHighlight: '[]',
		attributesToRetrieve: FIELDS,
		hitsPerPage: String(FRONT_PAGE_HITS),
		tags: 'front_page',
	})
	return `${SEARCH_URL}?${params}`
}

export function searchUrl(ids: readonly number[]): string {
	const params = new URLSearchParams({
		attributesToHighlight: '[]',
		attributesToRetrieve: FIELDS,
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
		url: safeUrl(hit.url) ?? discussion,
		comments: { count: hit.num_comments ?? 0, label: 'comment', url: discussion },
		score: { label: 'point', value: hit.points ?? 0 },
	}
	if (hit.created_at_i) item.time = hit.created_at_i * SECOND
	return item
}

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
		const [top, frontPage] = await Promise.all([
			getJson<number[]>(TOP_URL, ctx),
			getJson<SearchResponse>(frontPageUrl(), ctx),
		])
		const ids = top.slice(0, CANDIDATES)
		const items = parse(ids, frontPage)
		if (items.length >= LIMIT) return items
		return parse(ids, await getJson<SearchResponse>(searchUrl(ids), ctx))
	},
}

export default adapter
