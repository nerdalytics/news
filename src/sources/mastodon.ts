import { safeUrl } from '../format'
import { getJson } from '../net'
import { type FeedItem, LIMIT, type SourceAdapter } from './types'

const ENDPOINT = `https://mastodon.social/api/v1/trends/links?limit=${LIMIT}`

interface TrendLink {
	url: string
	title: string
	description?: string | null
	provider_name?: string | null
	published_at?: string | null
	history?: Array<{ day: string; accounts: string; uses: string }>
}

const SHARE_DAYS = 2

function recentUses(link: TrendLink): number {
	const days = link.history?.slice(0, SHARE_DAYS) ?? []
	return days.reduce((sum, day) => sum + (Number(day.uses) || 0), 0)
}

function toItem(link: TrendLink): FeedItem | undefined {
	const url = safeUrl(link.url)
	if (!url || !link.title) return undefined
	const item: FeedItem = {
		id: url,
		title: link.title,
		url,
		score: { label: 'share', value: recentUses(link) },
	}
	if (link.description) item.description = link.description
	if (link.provider_name) item.tag = link.provider_name
	if (link.published_at) item.time = Date.parse(link.published_at)
	return item
}

export function parse(links: TrendLink[]): FeedItem[] {
	return links.flatMap((link) => toItem(link) ?? []).slice(0, LIMIT)
}

const adapter: SourceAdapter = {
	async fetch(ctx) {
		return parse(await getJson<TrendLink[]>(ENDPOINT, ctx))
	},
}

export default adapter
