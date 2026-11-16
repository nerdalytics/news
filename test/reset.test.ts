import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readCookie, writeCookie } from '../src/cookies'
import { startFresh } from '../src/reset'

describe('startFresh', () => {
	beforeEach(() => {
		// jsdom cannot navigate. The reload is replaced by a spy.
		vi.stubGlobal('location', { ...location, pathname: '/tureel/', replace: vi.fn() })
	})

	it('deletes the settings cookies and everything the app stored', async () => {
		writeCookie('tureel_sources', 'hn.github')
		writeCookie('tureel_theme', 'dark')
		localStorage.setItem('tureel:feed:v1:hn', '{}')
		localStorage.setItem('tureel:read:v1', '[]')
		localStorage.setItem('tureel:blocked:v1', '["slate.com"]')
		localStorage.setItem('another-app', 'keep')

		await startFresh()

		expect(readCookie('tureel_sources')).toBeUndefined()
		expect(readCookie('tureel_theme')).toBeUndefined()
		expect(Object.keys(localStorage)).toEqual(['another-app'])
		expect(location.replace).toHaveBeenCalledWith('/tureel/')
	})
})
