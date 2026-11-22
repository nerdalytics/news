import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

async function load(): Promise<typeof import('../src/seen')> {
	vi.resetModules()
	return import('../src/seen')
}

describe('seen items', () => {
	beforeEach(() => {
		localStorage.clear()
	})

	it('remembers shown items per source across page loads', async () => {
		const first = await load()
		expect(first.isSeen('hn', 'https://example.com/a')).toBe(false)
		first.markSeen('hn', ['https://example.com/a', 'https://example.com/b'])

		const second = await load()
		expect(second.isSeen('hn', 'https://example.com/a')).toBe(true)
		expect(second.isSeen('hn', 'https://example.com/b')).toBe(true)
		expect(second.isSeen('github', 'https://example.com/a')).toBe(false)
	})

	it('keeps the 200 most recently shown items per source', async () => {
		const seen = await load()
		const urls = Array.from({ length: 210 }, (_, index) => `https://example.com/${index}`)
		seen.markSeen('hn', urls)
		expect(seen.isSeen('hn', 'https://example.com/0')).toBe(false)
		expect(seen.isSeen('hn', 'https://example.com/10')).toBe(true)
		expect(seen.isSeen('hn', 'https://example.com/209')).toBe(true)
		expect(JSON.parse(localStorage.getItem('thenews:seen:v1:hn') ?? '[]')).toHaveLength(200)
	})

	it('starts empty when the stored list is invalid', async () => {
		localStorage.setItem('thenews:seen:v1:hn', '{"not":"a list"}')
		expect((await load()).isSeen('hn', 'https://example.com/a')).toBe(false)
		localStorage.setItem('thenews:seen:v1:hn', 'not json')
		expect((await load()).isSeen('hn', 'https://example.com/a')).toBe(false)
	})
})
