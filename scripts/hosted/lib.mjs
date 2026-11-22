import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

const TIMEOUT_MS = 20_000
const MIN_ITEMS = 5
export const LIMIT = 20

function userAgent() {
	const repository = process.env.GITHUB_REPOSITORY
	return repository ? `feed-fetcher (+https://github.com/${repository})` : 'feed-fetcher'
}

async function request(url, init = {}) {
	const response = await fetch(url, {
		...init,
		headers: { 'User-Agent': userAgent(), ...init.headers },
		signal: AbortSignal.timeout(TIMEOUT_MS),
	})
	if (!response.ok) throw new Error(`${new URL(url).host} answered HTTP ${response.status}`)
	return response
}

export async function getJson(url, init) {
	return (await request(url, { ...init, headers: { Accept: 'application/json', ...init?.headers } })).json()
}

export async function getText(url, init) {
	return (await request(url, init)).text()
}

function isHttpUrl(value) {
	try {
		const { protocol } = new URL(value)
		return protocol === 'https:' || protocol === 'http:'
	} catch {
		return false
	}
}

export function validate(items) {
	const valid = items.filter((item) => typeof item?.title === 'string' && item.title && isHttpUrl(item.url))
	if (valid.length < MIN_ITEMS) {
		throw new Error(`Only ${valid.length} usable entries, expected at least ${MIN_ITEMS}`)
	}
	return valid.slice(0, LIMIT)
}

export async function writeFeed(path, source, items) {
	const feed = { generatedAt: Date.now(), items: validate(items), source }
	await mkdir(dirname(path), { recursive: true })
	await writeFile(path, `${JSON.stringify(feed)}\n`)
	return feed
}

const ENTITIES = { amp: '&', apos: "'", gt: '>', lt: '<', quot: '"' }

export function decodeXml(text) {
	return text.replace(/&(#\d+|#x[0-9a-fA-F]+|[a-z]+);/g, (match, body) => {
		if (body.startsWith('#x')) return String.fromCodePoint(Number.parseInt(body.slice(2), 16))
		if (body.startsWith('#')) return String.fromCodePoint(Number.parseInt(body.slice(1), 10))
		return ENTITIES[body] ?? match
	})
}

function unwrapCdata(text) {
	return text.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
}

function xmlTag(block, name) {
	const match = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`).exec(block)
	return match ? decodeXml(unwrapCdata(match[1]).trim()) : ''
}

function atomLink(block) {
	const alternate =
		/<link[^>]*rel="alternate"[^>]*href="([^"]+)"/.exec(block) ??
		/<link[^>]*href="([^"]+)"[^>]*rel="alternate"/.exec(block)
	const any = /<link[^>]*href="([^"]+)"/.exec(block)
	return decodeXml((alternate ?? any)?.[1] ?? '')
}

/** Reduces an HTML excerpt to plain text. */
function stripHtml(text) {
	return text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * Parses an RSS 2.0 or Atom feed into entries. Titles and excerpts arrive as
 * HTML or CDATA, so they are decoded and stripped to plain text. Entries
 * without a title or a link are dropped; `validate` still applies the limit.
 */
export function parseFeed(xml) {
	const items = []
	for (const block of xml.split(/<item[\s>]|<entry[\s>]/).slice(1)) {
		const title = stripHtml(xmlTag(block, 'title'))
		const url = xmlTag(block, 'link') || atomLink(block)
		if (!title || !url) continue
		const item = { id: xmlTag(block, 'guid') || xmlTag(block, 'id') || url, title, url }
		const time = Date.parse(
			xmlTag(block, 'pubDate') || xmlTag(block, 'published') || xmlTag(block, 'updated')
		)
		if (!Number.isNaN(time)) item.time = time
		const description = stripHtml(
			xmlTag(block, 'description') || xmlTag(block, 'summary') || xmlTag(block, 'content')
		)
		if (description) item.description = description
		items.push(item)
	}
	return items
}
