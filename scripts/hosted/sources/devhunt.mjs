import { getJson } from '../lib.mjs'

const ENDPOINT = 'https://devhunt.org/api/home/more-launches'

export default async function fetchItems() {
	const { launches } = await getJson(ENDPOINT)
	return launches.map(({ rank, tool }) => ({
		description: tool.slogan,
		id: String(tool.id),
		rank,
		score: { label: 'vote', value: tool.votes_count },
		title: tool.name,
		url: tool.demo_url || `https://devhunt.org/tool/${tool.slug}`,
	}))
}
