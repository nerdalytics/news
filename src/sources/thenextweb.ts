import { safeUrl } from '../format'
import { getText } from '../net'
import { type FeedItem, LIMIT, type SourceAdapter } from './types'

/** The public RSS feed; it is served with CORS headers. */
const ENDPOINT = 'https://thenextweb.com/feed'

function text(parent: Element, tag: string): string {
	return parent.getElementsByTagName(tag)[0]?.textContent?.trim() ?? ''
}

function toItem(entry: Element): FeedItem | undefined {
	const title = text(entry, 'title')
	const url = safeUrl(text(entry, 'link'))
	if (!title || !url) return undefined
	const item: FeedItem = { id: text(entry, 'guid') || url, title, url }
	const time = Date.parse(text(entry, 'pubDate'))
	if (!Number.isNaN(time)) item.time = time
	const category = text(entry, 'category')
	if (category) item.tag = category
	return item
}

export function parse(xml: string): FeedItem[] {
	const feed = new DOMParser().parseFromString(xml, 'text/xml')
	if (feed.getElementsByTagName('parsererror').length > 0) throw new Error('Invalid feed')
	const entries = Array.from(feed.getElementsByTagName('item'))
	return entries.flatMap((entry) => toItem(entry) ?? []).slice(0, LIMIT)
}

const adapter: SourceAdapter = {
	async fetch(ctx) {
		return parse(await getText(ENDPOINT, ctx, 'application/rss+xml, application/xml;q=0.9'))
	},
}

export default adapter
