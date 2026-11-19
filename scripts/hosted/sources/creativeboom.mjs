import { getText, parseFeed } from '../lib.mjs'

/** Creative Boom's RSS feed of latest articles. */
const ENDPOINT = 'https://www.creativeboom.com/feed/'

export default async function fetchItems() {
	const feed = await getText(ENDPOINT, {
		headers: { Accept: 'application/rss+xml, application/atom+xml, application/xml;q=0.9' },
	})
	return parseFeed(feed)
}
