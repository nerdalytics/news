import { getJson } from '../lib.mjs'

const ENDPOINT = 'https://haveibeenpwned.com/api/v3/breaches'

export default async function fetchItems() {
	const breaches = await getJson(ENDPOINT)
	return breaches
		.slice()
		.sort((a, b) => Date.parse(b.AddedDate) - Date.parse(a.AddedDate))
		.map((breach) => ({
			id: breach.Name,
			title: `${breach.Title} breach`,
			url: `https://haveibeenpwned.com/PwnedWebsites#${breach.Name}`,
			time: Date.parse(breach.AddedDate),
		}))
}
