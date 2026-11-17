import { getJson } from '../lib.mjs'

/**
 * This week's launches on DevHunt. The route is the one the home page uses to
 * load more entries, so it starts at rank 41. Each entry carries its real rank.
 */
const ENDPOINT = 'https://devhunt.org/api/home/more-launches'

export default async function fetchItems() {
	const { launches } = await getJson(ENDPOINT)
	return launches.map(({ rank, tool }) => ({
		description: tool.slogan,
		id: String(tool.id),
		rank,
		score: { label: 'vote', value: tool.votes_count },
		title: tool.name,
		// The product's own site, or its DevHunt page if it has none.
		url: tool.demo_url || `https://devhunt.org/tool/${tool.slug}`,
	}))
}
