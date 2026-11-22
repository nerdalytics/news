import { getJson } from '../lib.mjs'

const API = 'https://smollaunch.com/api/v1'

export default async function fetchItems() {
	const { launch_periods: periods } = await getJson(`${API}/launch_periods`)
	const current = periods.find((period) => period.status === 'active') ?? periods[0]
	const { rankings } = await getJson(`${API}/launch_periods/${current.slug}`)
	return rankings.map((entry) => ({
		comments: { count: entry.comments, label: 'comment', url: entry.url },
		description: entry.tagline,
		id: entry.product,
		score: { label: 'vote', value: entry.votes },
		title: entry.name,
		url: entry.url,
	}))
}
