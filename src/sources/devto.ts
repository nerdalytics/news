import { safeUrl } from '../format'
import { getJson } from '../net'
import { type FeedItem, LIMIT, type SourceAdapter } from './types'

/** Forem API. Returns the most popular articles of the last day. */
const ENDPOINT = `https://dev.to/api/articles?top=1&per_page=${LIMIT}`

export interface Article {
	id: number
	title: string
	url: string
	description?: string | null
	comments_count?: number
	public_reactions_count?: number
	published_at?: string
}

function toItem(article: Article): FeedItem | undefined {
	const url = safeUrl(article.url)
	if (!url) return undefined
	const item: FeedItem = {
		id: String(article.id),
		title: article.title,
		url,
		comments: { count: article.comments_count ?? 0, label: 'comment', url: `${url}#comments` },
		score: { label: 'reaction', value: article.public_reactions_count ?? 0 },
	}
	if (article.description) item.description = article.description
	if (article.published_at) item.time = Date.parse(article.published_at)
	return item
}

export function parse(articles: Article[]): FeedItem[] {
	return articles.flatMap((article) => toItem(article) ?? []).slice(0, LIMIT)
}

const adapter: SourceAdapter = {
	async fetch(ctx) {
		return parse(await getJson<Article[]>(ENDPOINT, ctx))
	},
}

export default adapter
