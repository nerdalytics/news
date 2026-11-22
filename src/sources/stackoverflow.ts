import { decodeEntities, safeUrl } from '../format'
import { getJson } from '../net'
import { SECOND } from '../time'
import { type FeedItem, LIMIT, type SourceAdapter } from './types'

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
		title: decodeEntities(question.title),
		url,
		comments: { count: question.answer_count, label: 'answer', url: `${url}#answers` },
		score: { label: 'vote', value: question.score },
	}
	if (question.creation_date) item.time = question.creation_date * SECOND
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
