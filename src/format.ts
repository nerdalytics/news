const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

const AGE_UNITS: ReadonlyArray<readonly [size: number, suffix: string]> = [
	[365 * DAY, 'y'],
	[30 * DAY, 'mo'],
	[7 * DAY, 'w'],
	[DAY, 'd'],
	[HOUR, 'h'],
	[MINUTE, 'm'],
]

/** Formats an age for feed rows, for example `2h`, `3d` or `now`. */
export function timeAgo(time: number, now = Date.now()): string {
	const age = now - time
	for (const [size, suffix] of AGE_UNITS) {
		if (age >= size) return `${Math.floor(age / size)}${suffix}`
	}
	return 'now'
}

const COMPACT = new Intl.NumberFormat('en', { maximumFractionDigits: 1, notation: 'compact' })

/** Formats `1234` as `1.2K`. */
export function compact(value: number): string {
	return COMPACT.format(value)
}

/** Formats a count with its noun. `count(1, 'point')` returns `1 point` and `count(1234, 'star')` returns `1.2K stars`. */
export function count(value: number, noun: string): string {
	return `${compact(value)} ${noun}${value === 1 ? '' : 's'}`
}

/** Returns the URL if it is an absolute http or https URL. Feed content is untrusted input. */
export function safeUrl(value: unknown): string | undefined {
	if (typeof value !== 'string') return undefined
	try {
		const url = new URL(value)
		return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : undefined
	} catch {
		return undefined
	}
}

export function hostOf(url: string): string {
	return new URL(url).hostname.replace(/^www\./, '')
}

const NAMED_ENTITIES: Record<string, string> = {
	amp: '&',
	apos: "'",
	gt: '>',
	lt: '<',
	nbsp: ' ',
	quot: '"',
}

function decodeEntity(match: string, body: string): string {
	if (body.startsWith('#')) {
		const hex = body[1] === 'x' || body[1] === 'X'
		const code = Number.parseInt(body.slice(hex ? 2 : 1), hex ? 16 : 10)
		return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match
	}
	return NAMED_ENTITIES[body] ?? match
}

/** Decodes HTML entities such as `&quot;` and `&#39;`, which some APIs leave in plain-text fields. */
export function decodeEntities(text: string): string {
	return text.replace(/&(#\d+|#[xX][0-9a-fA-F]+|[a-zA-Z]+);/g, decodeEntity)
}

/** Formats the UTC date as `YYYY/MM/DD` for APIs that take the date in the URL path. */
export function utcDatePath(date: Date): string {
	return date.toISOString().slice(0, 10).replaceAll('-', '/')
}
