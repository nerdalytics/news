import { beforeEach, describe, expect, it, vi } from 'vitest'

const KEY = 'thenews:read:v1'

/** The module keeps its list in memory, so every test loads a fresh copy. */
async function load(): Promise<typeof import('../src/read')> {
	vi.resetModules()
	return import('../src/read')
}

describe('read links', () => {
	beforeEach(() => {
		localStorage.clear()
	})

	it('remembers an opened link across page loads', async () => {
		const first = await load()
		expect(first.isRead('https://example.com/a')).toBe(false)
		first.markRead('https://example.com/a')
		expect(first.isRead('https://example.com/a')).toBe(true)

		const second = await load()
		expect(second.isRead('https://example.com/a')).toBe(true)
		expect(second.isRead('https://example.com/b')).toBe(false)
	})

	it('forgets a link that is marked as unread', async () => {
		const read = await load()
		read.markRead('https://example.com/a')
		read.markRead('https://example.com/b')
		read.markUnread('https://example.com/a')
		expect(read.isRead('https://example.com/a')).toBe(false)
		expect(read.isRead('https://example.com/b')).toBe(true)
		expect((await load()).isRead('https://example.com/a')).toBe(false)
	})

	it('keeps the 500 most recently opened links', async () => {
		const read = await load()
		for (let index = 0; index < 510; index++) read.markRead(`https://example.com/${index}`)
		// Opening an old link again moves it to the recent end of the list.
		read.markRead('https://example.com/20')
		expect(read.isRead('https://example.com/9')).toBe(false)
		expect(read.isRead('https://example.com/20')).toBe(true)
		expect(read.isRead('https://example.com/509')).toBe(true)
		expect(JSON.parse(localStorage.getItem(KEY) ?? '[]')).toHaveLength(500)
	})

	it('starts empty when the stored list is invalid', async () => {
		localStorage.setItem(KEY, '{"not":"a list"}')
		expect((await load()).isRead('https://example.com/a')).toBe(false)
		localStorage.setItem(KEY, 'not json')
		expect((await load()).isRead('https://example.com/a')).toBe(false)
	})
})
