import { safeUrl } from '../format'
import { getJson } from '../net'
import { type FeedItem, LIMIT, type SourceAdapter } from './types'

/**
 * Nick Launches' documented read API. Returns this week's launches, ranked by
 * upvotes. The trailing slash matters: without it the server redirects, and the
 * redirect carries no CORS header.
 */
const ENDPOINT = 'https://nicklaunches.com/api/v1/feed/week/'

interface Product {
	slug: string
	name: string
	tagline?: string | null
	/** The product's own site. */
	url?: string | null
	/** The product's page on Nick Launches, with its comments. */
	productUrl?: string | null
	upvotes?: number
	commentCount?: number
}

export interface WeekResponse {
	items: Product[]
}

function toItem(product: Product): FeedItem | undefined {
	const page = safeUrl(product.productUrl)
	const url = safeUrl(product.url) ?? page
	if (!url || !product.name) return undefined
	const item: FeedItem = {
		id: product.slug,
		title: product.name,
		url,
		score: { label: 'upvote', value: product.upvotes ?? 0 },
	}
	if (product.tagline) item.description = product.tagline
	if (page) item.comments = { count: product.commentCount ?? 0, label: 'comment', url: page }
	return item
}

export function parse(response: WeekResponse): FeedItem[] {
	return response.items.flatMap((product) => toItem(product) ?? []).slice(0, LIMIT)
}

const adapter: SourceAdapter = {
	async fetch(ctx) {
		return parse(await getJson<WeekResponse>(ENDPOINT, ctx))
	},
}

export default adapter
