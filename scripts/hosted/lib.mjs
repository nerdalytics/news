import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

/** A request that takes longer than this fails the run. */
const TIMEOUT_MS = 20_000
/** A feed with fewer entries than this is not published. The last good feed stays in place. */
const MIN_ITEMS = 5
/** The app shows at most this many entries per source. */
export const LIMIT = 20

/** Tells the source who is asking. Inside a workflow it names the repository. */
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

/** Keeps the entries that have a title and a web address. Throws if too few remain. */
export function validate(items) {
	const valid = items.filter((item) => typeof item?.title === 'string' && item.title && isHttpUrl(item.url))
	if (valid.length < MIN_ITEMS) {
		throw new Error(`Only ${valid.length} usable entries, expected at least ${MIN_ITEMS}`)
	}
	return valid.slice(0, LIMIT)
}

/** Writes the feed file the app reads. `generatedAt` is in epoch milliseconds. */
export async function writeFeed(path, source, items) {
	const feed = { generatedAt: Date.now(), items: validate(items), source }
	await mkdir(dirname(path), { recursive: true })
	await writeFile(path, `${JSON.stringify(feed)}\n`)
	return feed
}

const ENTITIES = { amp: '&', apos: "'", gt: '>', lt: '<', quot: '"' }

/** Decodes the XML entities of a text node or an attribute value. */
export function decodeXml(text) {
	return text.replace(/&(#\d+|#x[0-9a-fA-F]+|[a-z]+);/g, (match, body) => {
		if (body.startsWith('#x')) return String.fromCodePoint(Number.parseInt(body.slice(2), 16))
		if (body.startsWith('#')) return String.fromCodePoint(Number.parseInt(body.slice(1), 10))
		return ENTITIES[body] ?? match
	})
}
