import { getText, parseFeed } from '../lib.mjs'

/** WIRED's RSS feed of latest stories. */
const ENDPOINT = 'https://www.wired.com/feed/rss'

export default async function fetchItems() {
	const feed = await getText(ENDPOINT, {
		headers: { Accept: 'application/rss+xml, application/atom+xml, application/xml;q=0.9' },
	})
	return parseFeed(feed)
}
