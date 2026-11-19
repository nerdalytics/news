import { getText, parseFeed } from '../lib.mjs'

/** Awwwards' FeedBurner feed of the sites of the day. */
const ENDPOINT = 'http://feeds.feedburner.com/awwwards-sites-of-the-day'

export default async function fetchItems() {
	const feed = await getText(ENDPOINT, {
		headers: { Accept: 'application/rss+xml, application/atom+xml, application/xml;q=0.9' },
	})
	return parseFeed(feed)
}
