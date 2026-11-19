import { getText, parseFeed } from '../lib.mjs'

/** Site Inspire's RSS feed of newly featured websites. */
const ENDPOINT = 'https://www.siteinspire.com/websites/feed'

export default async function fetchItems() {
	const feed = await getText(ENDPOINT, {
		headers: { Accept: 'application/rss+xml, application/atom+xml, application/xml;q=0.9' },
	})
	return parseFeed(feed)
}
