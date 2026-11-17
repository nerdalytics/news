import { describe, expect, it } from 'vitest'
import { parseCookies } from '../src/cookies'
import {
	parseBlocked,
	parseSources,
	parseSwipe,
	parseTheme,
	serializeSources,
	serializeSwipe,
} from '../src/settings'
import { SOURCES } from '../src/sources/index'
import type { SourceMeta } from '../src/sources/types'

function source(id: string): SourceMeta {
	return {
		accent: ['#000', '#fff'],
		badge: ['#000', '#fff'],
		comments: false,
		home: 'https://example.com/',
		id,
		mark: id,
		name: id,
		tagline: '',
		ttl: 5,
	}
}

const CATALOGUE = [source('a'), source('b'), source('c')]

describe('parseSources', () => {
	it('switches nothing on without a cookie', () => {
		expect(parseSources(undefined, CATALOGUE)).toEqual([
			{ enabled: false, id: 'a' },
			{ enabled: false, id: 'b' },
			{ enabled: false, id: 'c' },
		])
	})

	it('keeps the stored order and state', () => {
		expect(parseSources('c.-a.b', CATALOGUE)).toEqual([
			{ enabled: true, id: 'c' },
			{ enabled: false, id: 'a' },
			{ enabled: true, id: 'b' },
		])
	})

	it('drops unknown and duplicate ids', () => {
		expect(parseSources('zzz.a.a.-a.c.b', CATALOGUE).map((entry) => entry.id)).toEqual([
			'a',
			'c',
			'b',
		])
	})

	it('appends sources added to the catalogue later, switched off', () => {
		expect(parseSources('c', CATALOGUE)).toEqual([
			{ enabled: true, id: 'c' },
			{ enabled: false, id: 'a' },
			{ enabled: false, id: 'b' },
		])
	})

	it('treats an empty cookie as "everything switched off"', () => {
		expect(parseSources('', CATALOGUE).every((entry) => !entry.enabled)).toBe(true)
	})

	it('round-trips through serializeSources', () => {
		const raw = 'c.-a.b'
		expect(serializeSources(parseSources(raw, CATALOGUE))).toBe(raw)
	})
})

describe('parseTheme', () => {
	it('accepts the two explicit themes and defaults to auto', () => {
		expect(parseTheme('light')).toBe('light')
		expect(parseTheme('dark')).toBe('dark')
		expect(parseTheme(undefined)).toBe('auto')
		expect(parseTheme('sepia')).toBe('auto')
	})
})

describe('blocked sites', () => {
	it('accepts a stored list of hosts', () => {
		expect(parseBlocked(['slate.com', 'pub.cba.mit.edu'])).toEqual(['slate.com', 'pub.cba.mit.edu'])
	})

	it('is empty for anything that is not a list', () => {
		expect(parseBlocked(undefined)).toEqual([])
		expect(parseBlocked('slate.com')).toEqual([])
		expect(parseBlocked({ host: 'slate.com' })).toEqual([])
	})

	it('drops duplicates and entries that are not host names', () => {
		expect(parseBlocked(['a.com', 'a.com', '<script>', 42, 'b.org', 'Not A Host'])).toEqual([
			'a.com',
			'b.org',
		])
	})

	it('has no size limit', () => {
		const hosts = Array.from({ length: 1000 }, (_, index) => `site${index}.example`)
		expect(parseBlocked(hosts)).toHaveLength(1000)
	})
})

describe('swipe settings', () => {
	it('assigns no action without a cookie', () => {
		expect(parseSwipe(undefined)).toEqual({})
		expect(parseSwipe('')).toEqual({})
	})

	it('reads one action per swipe', () => {
		expect(parseSwipe('left_read.leftlong_hide.right_unread.rightlong_block')).toEqual({
			left: 'read',
			leftLong: 'hide',
			right: 'unread',
			rightLong: 'block',
		})
		expect(parseSwipe('rightlong_browser')).toEqual({ rightLong: 'browser' })
	})

	it('drops unknown swipes and actions', () => {
		expect(parseSwipe('up_read.left_explode.left.right_comments')).toEqual({ right: 'comments' })
	})

	it('round-trips through serializeSwipe', () => {
		for (const raw of [
			'',
			'left_read',
			'leftlong_hide.right_unread',
			'left_comments.rightlong_browser',
		]) {
			expect(serializeSwipe(parseSwipe(raw))).toBe(raw)
		}
	})
})

describe('parseCookies', () => {
	it('reads name/value pairs and decodes values', () => {
		const cookies = parseCookies('thenews_theme=dark; other=a%20b; thenews_sources=hn.-github')
		expect(cookies.get('thenews_theme')).toBe('dark')
		expect(cookies.get('other')).toBe('a b')
		expect(cookies.get('thenews_sources')).toBe('hn.-github')
	})

	it('ignores malformed pairs', () => {
		expect(parseCookies('').size).toBe(0)
		expect(parseCookies('novalue; bad=%E0%A4%A; ok=1').get('ok')).toBe('1')
	})
})

describe('catalogue', () => {
	it('uses ids that survive the cookie format', () => {
		for (const { id } of SOURCES) expect(id).toMatch(/^[a-z0-9]+$/)
		expect(new Set(SOURCES.map((entry) => entry.id)).size).toBe(SOURCES.length)
	})

	it('includes the two required sources', () => {
		const ids = SOURCES.map((entry) => entry.id)
		expect(ids).toContain('hn')
		expect(ids).toContain('github')
	})
})
