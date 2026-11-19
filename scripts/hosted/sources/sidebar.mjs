import { getText, parseFeed } from '../lib.mjs'

/** Sidebar's RSS feed of daily design links. */
const ENDPOINT = 'https://sidebar.io/feed.xml'

export default async function fetchItems() {
	const feed = await getText(ENDPOINT, {
		headers: { Accept: 'application/rss+xml, application/atom+xml, application/xml;q=0.9' },
	})
	return parseFeed(feed)
}
