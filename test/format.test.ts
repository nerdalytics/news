import { describe, expect, it } from 'vitest'
import {
	compact,
	count,
	decodeEntities,
	hostOf,
	safeUrl,
	timeAgo,
	utcDatePath,
} from '../src/format'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

describe('timeAgo', () => {
	const now = Date.UTC(2026, 10, 15, 12)

	it.each([
		[30_000, 'now'],
		[5 * MINUTE, '5m'],
		[2 * HOUR + 59 * MINUTE, '2h'],
		[3 * DAY, '3d'],
		[15 * DAY, '2w'],
		[70 * DAY, '2mo'],
		[800 * DAY, '2y'],
	])('formats an age of %d ms as %s', (age, expected) => {
		expect(timeAgo(now - age, now)).toBe(expected)
	})

	it('treats timestamps in the future as now', () => {
		expect(timeAgo(now + HOUR, now)).toBe('now')
	})
})

describe('count', () => {
	it('pluralises the noun', () => {
		expect(count(0, 'comment')).toBe('0 comments')
		expect(count(1, 'comment')).toBe('1 comment')
		expect(count(45, 'comment')).toBe('45 comments')
	})

	it('shortens large numbers', () => {
		expect(compact(25_517)).toBe('25.5K')
		expect(count(1_234_567, 'view')).toBe('1.2M views')
	})
})

describe('safeUrl', () => {
	it('accepts absolute http and https URLs', () => {
		expect(safeUrl('https://example.com/a?b=1')).toBe('https://example.com/a?b=1')
		expect(safeUrl('http://example.com')).toBe('http://example.com/')
	})

	it('rejects everything else', () => {
		expect(safeUrl('javascript:alert(1)')).toBeUndefined()
		expect(safeUrl('data:text/html,hi')).toBeUndefined()
		expect(safeUrl('/relative')).toBeUndefined()
		expect(safeUrl('')).toBeUndefined()
		expect(safeUrl(null)).toBeUndefined()
		expect(safeUrl(42)).toBeUndefined()
	})
})

describe('hostOf', () => {
	it('drops a leading www', () => {
		expect(hostOf('https://www.example.com/path')).toBe('example.com')
		expect(hostOf('https://news.ycombinator.com/')).toBe('news.ycombinator.com')
	})
})

describe('decodeEntities', () => {
	it('decodes named and numeric entities', () => {
		expect(decodeEntities('a &quot;b&quot; &amp; c&#39;s &lt;d&gt; &#x41;')).toBe(
			'a "b" & c\'s <d> A'
		)
	})

	it('leaves unknown entities and bare ampersands alone', () => {
		expect(decodeEntities('R&D &unknown; &#0;')).toBe('R&D &unknown; &#0;')
	})

	it('decodes only once', () => {
		expect(decodeEntities('&amp;lt;')).toBe('&lt;')
	})
})

describe('utcDatePath', () => {
	it('formats the UTC date for use in a URL path', () => {
		expect(utcDatePath(new Date(Date.UTC(2026, 0, 5, 23, 59)))).toBe('2026/01/05')
	})
})
