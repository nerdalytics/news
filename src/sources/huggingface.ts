import { getJson } from '../net'
import { type FeedItem, LIMIT, type SourceAdapter } from './types'

/** Hugging Face Hub API. Returns models ordered by the Hub's trending score. */
const ENDPOINT = `https://huggingface.co/api/models?sort=trendingScore&limit=${LIMIT}`

interface Model {
	id: string
	likes?: number
	pipeline_tag?: string
	createdAt?: string
}

function toItem(model: Model): FeedItem {
	const item: FeedItem = {
		id: model.id,
		title: model.id,
		// A model id has the form `owner/name`. Encode both parts and keep the slash.
		url: `https://huggingface.co/${model.id.split('/').map(encodeURIComponent).join('/')}`,
		score: { label: 'like', value: model.likes ?? 0 },
	}
	if (model.pipeline_tag) item.tag = model.pipeline_tag
	if (model.createdAt) item.time = Date.parse(model.createdAt)
	return item
}

export function parse(models: Model[]): FeedItem[] {
	return models.map(toItem).slice(0, LIMIT)
}

const adapter: SourceAdapter = {
	async fetch(ctx) {
		return parse(await getJson<Model[]>(ENDPOINT, ctx))
	},
}

export default adapter
