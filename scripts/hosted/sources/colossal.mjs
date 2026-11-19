import { getText, parseFeed } from '../lib.mjs'

/** Colossal's RSS feed of latest posts. */
const ENDPOINT = 'https://www.thisiscolossal.com/feed/'

export default async function fetchItems() {
	const feed = await getText(ENDPOINT, {
		headers: { Accept: 'application/rss+xml, application/atom+xml, application/xml;q=0.9' },
	})
	return parseFeed(feed)
}
