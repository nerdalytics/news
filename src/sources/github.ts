import { safeUrl, utcDate } from '../format'
import { getJson } from '../net'
import { DAY } from '../time'
import { type FeedItem, LIMIT, type SourceAdapter } from './types'

/**
 * GitHub has no API for github.com/trending. This adapter uses the Search API
 * and asks for repositories created in the last week, ordered by stars.
 */
const SEARCH_URL = 'https://api.github.com/search/repositories'
const WINDOW_DAYS = 7

interface Repository {
	id: number
	full_name: string
	html_url: string
	description?: string | null
	stargazers_count: number
	language?: string | null
	created_at?: string
}

export interface SearchResponse {
	items: Repository[]
}

export function searchUrl(now = new Date()): string {
	const since = utcDate(new Date(now.getTime() - WINDOW_DAYS * DAY))
	const params = new URLSearchParams({
		order: 'desc',
		per_page: String(LIMIT),
		q: `created:>${since}`,
		sort: 'stars',
	})
	return `${SEARCH_URL}?${params}`
}

function toItem(repository: Repository): FeedItem | undefined {
	const url = safeUrl(repository.html_url)
	if (!url) return undefined
	const item: FeedItem = {
		id: String(repository.id),
		title: repository.full_name,
		url,
		score: { label: 'star', value: repository.stargazers_count },
	}
	if (repository.description) item.description = repository.description
	if (repository.language) item.tag = repository.language
	if (repository.created_at) item.time = Date.parse(repository.created_at)
	return item
}

export function parse(response: SearchResponse): FeedItem[] {
	return response.items.flatMap((repository) => toItem(repository) ?? []).slice(0, LIMIT)
}

const adapter: SourceAdapter = {
	async fetch(ctx) {
		return parse(await getJson<SearchResponse>(searchUrl(), ctx))
	},
}

export default adapter
