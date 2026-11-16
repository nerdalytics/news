import { describe, expect, it } from 'vitest'
import { parseCookies } from '../src/cookies'
import { parseSources, parseTheme, serializeSources } from '../src/settings'
import { SOURCES } from '../src/sources/index'
import type { SourceMeta } from '../src/sources/types'

function source(id: string, enabledByDefault: boolean): SourceMeta {
	return {
		accent: ['#000', '#fff'],
		badge: ['#000', '#fff'],
		comments: false,
		enabledByDefault,
		home: 'https://example.com/',
		id,
		mark: id,
		name: id,
		tagline: '',
		ttl: 5,
	}
}

const CATALOGUE = [source('a', true), source('b', false), source('c', true)]

describe('parseSources', () => {
	it('falls back to the catalogue defaults without a cookie', () => {
		expect(parseSources(undefined, CATALOGUE)).toEqual([
			{ enabled: true, id: 'a' },
			{ enabled: false, id: 'b' },
			{ enabled: true, id: 'c' },
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

describe('parseCookies', () => {
	it('reads name/value pairs and decodes values', () => {
		const cookies = parseCookies('tureel_theme=dark; other=a%20b; tureel_sources=hn.-github')
		expect(cookies.get('tureel_theme')).toBe('dark')
		expect(cookies.get('other')).toBe('a b')
		expect(cookies.get('tureel_sources')).toBe('hn.-github')
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

	it('includes the two required sources, on by default', () => {
		const byId = new Map(SOURCES.map((entry) => [entry.id, entry]))
		expect(byId.get('hn')?.enabledByDefault).toBe(true)
		expect(byId.get('github')?.enabledByDefault).toBe(true)
	})
})
