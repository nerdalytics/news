import { getJson } from '../net'
import { parse, type SearchResponse, searchUrl } from './hackernews'
import type { SourceAdapter } from './types'

/**
 * Show HN in page order. The official API returns the ranked ids, and one
 * Algolia HN Search request returns those stories with points and comments.
 */
const SHOW_URL = 'https://hacker-news.firebaseio.com/v0/showstories.json'
/** Look up more ids than needed, because the search index lags behind new posts. */
const CANDIDATES = 30

const adapter: SourceAdapter = {
	async fetch(ctx) {
		const ids = (await getJson<number[]>(SHOW_URL, ctx)).slice(0, CANDIDATES)
		return parse(ids, await getJson<SearchResponse>(searchUrl(ids), ctx))
	},
}

export default adapter
