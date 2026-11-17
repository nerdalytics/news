import { getJson } from '../lib.mjs'

/** The hottest stories, as on the Lobsters front page. */
const ENDPOINT = 'https://lobste.rs/hottest.json'

export default async function fetchItems() {
	const stories = await getJson(ENDPOINT)
	return stories.map((story) => ({
		comments: { count: story.comment_count, label: 'comment', url: story.comments_url },
		id: story.short_id,
		score: { label: 'point', value: story.score },
		time: Date.parse(story.created_at),
		title: story.title,
		// Text posts have no link, so the discussion is the entry.
		url: story.url || story.comments_url,
	}))
}
