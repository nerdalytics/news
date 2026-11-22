import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readCookie, writeCookie } from '../src/cookies'
import { startFresh } from '../src/reset'

describe('startFresh', () => {
	beforeEach(() => {
		vi.stubGlobal('location', { ...location, pathname: '/news/', replace: vi.fn() })
	})

	it('deletes the settings cookies and everything the app stored', async () => {
		writeCookie('thenews_sources', 'hn.github')
		writeCookie('thenews_theme', 'dark')
		localStorage.setItem('thenews:feed:v1:hn', '{}')
		localStorage.setItem('thenews:read:v1', '[]')
		localStorage.setItem('thenews:blocked:v1', '["slate.com"]')
		localStorage.setItem('another-app', 'keep')

		await startFresh()

		expect(readCookie('thenews_sources')).toBeUndefined()
		expect(readCookie('thenews_theme')).toBeUndefined()
		expect(Object.keys(localStorage)).toEqual(['another-app'])
		expect(location.replace).toHaveBeenCalledWith('/news/')
	})
})
