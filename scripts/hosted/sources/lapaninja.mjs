import { getText, parseFeed } from '../lib.mjs'

/** Lapa Ninja's RSS feed of newly featured landing pages. */
const ENDPOINT = 'https://www.lapa.ninja/index.xml'

export default async function fetchItems() {
	const feed = await getText(ENDPOINT, {
		headers: { Accept: 'application/rss+xml, application/atom+xml, application/xml;q=0.9' },
	})
	return parseFeed(feed)
}
