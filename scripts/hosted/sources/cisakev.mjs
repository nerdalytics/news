import { getJson } from '../lib.mjs'

const ENDPOINT = 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json'

export default async function fetchItems() {
	const catalog = await getJson(ENDPOINT)
	return catalog.vulnerabilities
		.slice()
		.sort((a, b) => Date.parse(b.dateAdded) - Date.parse(a.dateAdded))
		.map((entry) => ({
			id: entry.cveID,
			title: `${entry.cveID}: ${entry.vulnerabilityName}`,
			url: `https://nvd.nist.gov/vuln/detail/${entry.cveID}`,
			time: Date.parse(entry.dateAdded),
			description: entry.shortDescription,
		}))
}
