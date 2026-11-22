import { getJson } from '../net'
import { parse, type SearchResponse, searchUrl } from './hackernews'
import type { SourceAdapter } from './types'

const SHOW_URL = 'https://hacker-news.firebaseio.com/v0/showstories.json'
const CANDIDATES = 30

const adapter: SourceAdapter = {
	async fetch(ctx) {
		const ids = (await getJson<number[]>(SHOW_URL, ctx)).slice(0, CANDIDATES)
		return parse(ids, await getJson<SearchResponse>(searchUrl(ids), ctx))
	},
}

export default adapter
