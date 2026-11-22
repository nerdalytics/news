import { getJson } from '../lib.mjs'

const ENDPOINT = 'https://lobste.rs/hottest.json'

export default async function fetchItems() {
	const stories = await getJson(ENDPOINT)
	return stories.map((story) => ({
		comments: { count: story.comment_count, label: 'comment', url: story.comments_url },
		id: story.short_id,
		score: { label: 'point', value: story.score },
		time: Date.parse(story.created_at),
		title: story.title,
		url: story.url || story.comments_url,
	}))
}
