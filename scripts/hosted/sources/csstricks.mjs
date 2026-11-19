import { getText, parseFeed } from '../lib.mjs'

/** CSS-Tricks' RSS feed, served through FeedBurner. */
const ENDPOINT = 'http://feeds.feedburner.com/CssTricks'

export default async function fetchItems() {
	const feed = await getText(ENDPOINT, {
		headers: { Accept: 'application/rss+xml, application/atom+xml, application/xml;q=0.9' },
	})
	return parseFeed(feed)
}
