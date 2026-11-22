import { safeUrl } from '../format'
import { getJson } from '../net'
import { type FeedItem, LIMIT, type SourceAdapter } from './types'

const ENDPOINT = `https://kxdushqmihjyuddcwkpw.supabase.co/functions/v1/api-v1/products/top?n=${LIMIT}&period=week`

interface Product {
	id: string
	name: string
	tagline?: string | null
	website_url?: string | null
	url?: string | null
	upvotes?: number
	created_at?: string
}

export interface TopResponse {
	results: Product[]
}

function toItem(product: Product): FeedItem | undefined {
	const url = safeUrl(product.website_url) ?? safeUrl(product.url)
	if (!url || !product.name) return undefined
	const item: FeedItem = {
		id: product.id,
		title: product.name,
		url,
		score: { label: 'upvote', value: product.upvotes ?? 0 },
	}
	if (product.tagline) item.description = product.tagline
	if (product.created_at) item.time = Date.parse(product.created_at)
	return item
}

export function parse(response: TopResponse): FeedItem[] {
	return response.results.flatMap((product) => toItem(product) ?? []).slice(0, LIMIT)
}

const adapter: SourceAdapter = {
	async fetch(ctx) {
		return parse(await getJson<TopResponse>(ENDPOINT, ctx))
	},
}

export default adapter
