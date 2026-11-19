import { getText, parseFeed } from '../lib.mjs'

/** Booooooom's RSS feed of latest posts. */
const ENDPOINT = 'https://www.booooooom.com/feed/'

export default async function fetchItems() {
	const feed = await getText(ENDPOINT, {
		headers: { Accept: 'application/rss+xml, application/atom+xml, application/xml;q=0.9' },
	})
	return parseFeed(feed)
}
