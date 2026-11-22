import { DAY, HOUR, MINUTE } from './time'

const WEEK = 7 * DAY
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

export function timeAgo(time: number, now = Date.now()): string {
	const age = now - time
	for (const [size, suffix] of AGE_UNITS) {
		if (age >= size) return `${Math.floor(age / size)}${suffix}`
	}
	return 'now'
}

const COMPACT = new Intl.NumberFormat('en', { maximumFractionDigits: 1, notation: 'compact' })

export function compact(value: number): string {
	return COMPACT.format(value)
}

export function count(value: number, noun: string): string {
	return `${compact(value)} ${noun}${value === 1 ? '' : 's'}`
}

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

export function decodeEntities(text: string): string {
	return text.replace(/&(#\d+|#[xX][0-9a-fA-F]+|[a-zA-Z]+);/g, decodeEntity)
}

export function utcDatePath(date: Date): string {
	return utcDate(date).replaceAll('-', '/')
}

const ISO_DATE_LENGTH = 10

export function utcDate(date: Date): string {
	return date.toISOString().slice(0, ISO_DATE_LENGTH)
}
