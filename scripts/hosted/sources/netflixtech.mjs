import { getText, parseFeed } from '../lib.mjs'

const ENDPOINT = 'https://medium.com/feed/netflix-techblog'

function withoutTracking(url) {
	const parsed = new URL(url)
	parsed.searchParams.delete('source')
	return parsed.href
}

export default async function fetchItems() {
	const feed = await getText(ENDPOINT, {
		headers: { Accept: 'application/rss+xml, application/xml;q=0.9' },
	})
	return parseFeed(feed).map((item) => ({ ...item, url: withoutTracking(item.url) }))
}
