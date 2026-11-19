import { getText, parseFeed } from '../lib.mjs'

/** Netflix Tech Blog's RSS feed, hosted on Medium. */
const ENDPOINT = 'https://medium.com/feed/netflix-techblog'

/** Medium appends a rss tracking parameter to every link. */
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
