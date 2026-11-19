import { getText, parseFeed } from '../lib.mjs'

/** Behance's RSS feed of featured projects. */
const ENDPOINT = 'https://www.behance.net/feeds/projects'

export default async function fetchItems() {
	const feed = await getText(ENDPOINT, {
		headers: { Accept: 'application/rss+xml, application/xml;q=0.9' },
	})
	return parseFeed(feed)
}
