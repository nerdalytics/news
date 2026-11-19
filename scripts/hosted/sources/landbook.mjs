import { getText, parseFeed } from '../lib.mjs'

/** Land-book's RSS feed of newly featured websites. */
const ENDPOINT = 'https://land-book.com/feed/'

export default async function fetchItems() {
	const feed = await getText(ENDPOINT, {
		headers: { Accept: 'application/rss+xml, application/atom+xml, application/xml;q=0.9' },
	})
	return parseFeed(feed)
}
