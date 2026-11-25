import { decodeXml, getText } from '../lib.mjs'

const ENDPOINT = 'https://betalist.com/startups/feed_original'

function tag(entry, name) {
	const match = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`).exec(entry)
	return match ? decodeXml(match[1].trim()) : ''
}

function withoutTracking(link) {
	const url = new URL(link)
	for (const key of [...url.searchParams.keys()]) {
		if (key.startsWith('utm_')) url.searchParams.delete(key)
	}
	return url.href
}

function toItem(entry) {
	const link = /<link[^>]*rel="alternate"[^>]*href="([^"]+)"/.exec(entry)
	const [name, ...rest] = tag(entry, 'title').split(' – ')
	return {
		description: rest.join(' – ') || undefined,
		id: tag(entry, 'id'),
		time: Date.parse(tag(entry, 'published')),
		title: name,
		url: link ? withoutTracking(decodeXml(link[1])) : '',
	}
}

export default async function fetchItems() {
	const feed = await getText(ENDPOINT, { headers: { Accept: 'application/atom+xml' } })
	return feed.split('<entry>').slice(1).map(toItem)
}
