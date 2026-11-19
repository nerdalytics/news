import { getText, parseFeed } from '../lib.mjs'

/** The Verge's Atom feed. It carries only the ten most recent stories. */
const ENDPOINT = 'https://www.theverge.com/rss/index.xml'

export default async function fetchItems() {
	const feed = await getText(ENDPOINT, {
		headers: { Accept: 'application/atom+xml, application/xml;q=0.9' },
	})
	return parseFeed(feed)
}
