import { safeUrl, utcDatePath } from '../format'
import { getJson, HttpError, STATUS } from '../net'
import { DAY } from '../time'
import { type FeedItem, type FetchContext, LIMIT, type SourceAdapter } from './types'

const FEED_URL = 'https://api.wikimedia.org/feed/v1/wikipedia/en/featured'

const YESTERDAY = 1
const DAY_BEFORE = 2

interface Article {
	pageid: number
	views: number
	titles: { normalized: string }
	description?: string
	content_urls: { desktop: { page: string } }
}

export interface FeaturedResponse {
	mostread?: { articles: Article[] }
}

function toItem(article: Article): FeedItem | undefined {
	const url = safeUrl(article.content_urls.desktop.page)
	if (!url) return undefined
	const item: FeedItem = {
		id: String(article.pageid),
		title: article.titles.normalized,
		url,
		score: { label: 'view', value: article.views },
	}
	if (article.description) item.description = article.description
	return item
}

export function parse(response: FeaturedResponse): FeedItem[] {
	const articles = response.mostread?.articles ?? []
	return articles.flatMap((article) => toItem(article) ?? []).slice(0, LIMIT)
}

async function mostRead(daysAgo: number, ctx: FetchContext): Promise<FeedItem[]> {
	const day = new Date(Date.now() - daysAgo * DAY)
	try {
		return parse(await getJson<FeaturedResponse>(`${FEED_URL}/${utcDatePath(day)}`, ctx))
	} catch (error) {
		if (error instanceof HttpError && error.status === STATUS.notFound) return []
		throw error
	}
}

const adapter: SourceAdapter = {
	async fetch(ctx) {
		const items = await mostRead(YESTERDAY, ctx)
		return items.length > 0 ? items : mostRead(DAY_BEFORE, ctx)
	},
}

export default adapter
