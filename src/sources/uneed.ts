import { safeUrl } from '../format'
import { getJson } from '../net'
import { type FeedItem, LIMIT, type SourceAdapter } from './types'

const ENDPOINT = `https://mcp.uneed.best/v1/trending?period=daily&limit=${LIMIT}`

interface Tool {
	slug: string
	name: string
	description?: string | null
	url?: string | null
	uneed_url?: string | null
	vote_count?: number
}

export interface TrendingResponse {
	ranking: Tool[]
}

function toItem(tool: Tool): FeedItem | undefined {
	const url = safeUrl(tool.url) ?? safeUrl(tool.uneed_url)
	if (!url || !tool.name) return undefined
	const item: FeedItem = {
		id: tool.slug,
		title: tool.name,
		url,
		score: { label: 'vote', value: tool.vote_count ?? 0 },
	}
	if (tool.description) item.description = tool.description
	return item
}

export function parse(response: TrendingResponse): FeedItem[] {
	return response.ranking.flatMap((tool) => toItem(tool) ?? []).slice(0, LIMIT)
}

const adapter: SourceAdapter = {
	async fetch(ctx) {
		return parse(await getJson<TrendingResponse>(ENDPOINT, ctx))
	},
}

export default adapter
