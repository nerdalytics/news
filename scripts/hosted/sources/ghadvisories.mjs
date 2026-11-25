import { getJson } from '../lib.mjs'

const ENDPOINT = 'https://api.github.com/advisories?per_page=20'

export default async function fetchItems() {
	const advisories = await getJson(ENDPOINT)
	return advisories.map((advisory) => ({
		id: advisory.ghsa_id,
		title: advisory.summary,
		url: advisory.html_url,
		time: Date.parse(advisory.published_at),
		tag: advisory.severity,
	}))
}
