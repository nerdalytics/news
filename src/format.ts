import { DAY, HOUR, MINUTE } from './time'

const WEEK = 7 * DAY
/** Calendar months and years vary in length. These averages are close enough for an age label. */
const MONTH = 30 * DAY
const YEAR = 365 * DAY

const AGE_UNITS: ReadonlyArray<readonly [size: number, suffix: string]> = [
	[YEAR, 'y'],
	[MONTH, 'mo'],
	[WEEK, 'w'],
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

/** The highest code point Unicode defines. */
const MAX_CODE_POINT = 0x10ffff

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
		return code > 0 && code <= MAX_CODE_POINT ? String.fromCodePoint(code) : match
	}
	return NAMED_ENTITIES[body] ?? match
}

/** Decodes HTML entities such as `&quot;` and `&#39;`, which some APIs leave in plain-text fields. */
export function decodeEntities(text: string): string {
	return text.replace(/&(#\d+|#[xX][0-9a-fA-F]+|[a-zA-Z]+);/g, decodeEntity)
}

/** Formats the UTC date as `YYYY/MM/DD` for APIs that take the date in the URL path. */
export function utcDatePath(date: Date): string {
	return utcDate(date).replaceAll('-', '/')
}

/** The length of `YYYY-MM-DD` at the start of an ISO 8601 timestamp. */
const ISO_DATE_LENGTH = 10

/** Formats the UTC date as `YYYY-MM-DD`. */
export function utcDate(date: Date): string {
	return date.toISOString().slice(0, ISO_DATE_LENGTH)
}
