import { decodeEntities, safeUrl } from '../format'
import { getJson } from '../net'
import { type FeedItem, LIMIT, type SourceAdapter } from './types'

/**
 * Stack Exchange API, used without a key. All keyless requests from one IP
 * address share a daily quota, which the API reports as `quota_max: 300`. The
 * 30 minute cache limits automatic refreshes to 48 a day for each reader.
 */
const ENDPOINT = `https://api.stackexchange.com/2.3/questions?site=stackoverflow&sort=week&order=desc&pagesize=${LIMIT}`

interface Question {
	question_id: number
	title: string
	link: string
	score: number
	answer_count: number
	creation_date?: number
	tags?: string[]
}

export interface QuestionsResponse {
	items: Question[]
}

function toItem(question: Question): FeedItem | undefined {
	const url = safeUrl(question.link)
	if (!url) return undefined
	const item: FeedItem = {
		id: String(question.question_id),
		// The API HTML-encodes titles.
		title: decodeEntities(question.title),
		url,
		comments: { count: question.answer_count, label: 'answer', url: `${url}#answers` },
		score: { label: 'vote', value: question.score },
	}
	if (question.creation_date) item.time = question.creation_date * 1000
	const tag = question.tags?.[0]
	if (tag) item.tag = tag
	return item
}

export function parse(response: QuestionsResponse): FeedItem[] {
	return response.items.flatMap((question) => toItem(question) ?? []).slice(0, LIMIT)
}

const adapter: SourceAdapter = {
	async fetch(ctx) {
		return parse(await getJson<QuestionsResponse>(ENDPOINT, ctx))
	},
}

export default adapter
