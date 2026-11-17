import { beforeEach, describe, expect, it, vi } from 'vitest'
import { parseCookies, writeCookieNow } from '../src/cookies'

const cookie = (name: string): string | undefined => parseCookies(document.cookie).get(name)

function clearCookies(): void {
	for (const name of parseCookies(document.cookie).keys()) {
		// biome-ignore lint/suspicious/noDocumentCookie: the test environment has no Cookie Store API
		document.cookie = `${name}=; Max-Age=0; Path=/`
	}
}

/** The settings module migrates when it loads, so every test loads a fresh copy. */
async function loadSettings(): Promise<typeof import('../src/settings')> {
	vi.resetModules()
	return import('../src/settings')
}

describe('carrying data over', () => {
	beforeEach(() => {
		localStorage.clear()
		clearCookies()
	})

	it('renames what was stored under the former name', async () => {
		localStorage.setItem('tureel:blocked:v1', '["slate.com"]')
		localStorage.setItem('tureel:read:v1', '["https://example.com/a"]')
		localStorage.setItem('another-app', 'keep')
		const settings = await loadSettings()
		expect(settings.getSettings().blocked).toEqual(['slate.com'])
		expect(localStorage.getItem('thenews:read:v1')).toBe('["https://example.com/a"]')
		expect(Object.keys(localStorage).some((key) => key.startsWith('tureel:'))).toBe(false)
		expect(localStorage.getItem('another-app')).toBe('keep')
	})

	it('does not overwrite newer data with data of the former name', async () => {
		localStorage.setItem('tureel:blocked:v1', '["old.example"]')
		localStorage.setItem('thenews:blocked:v1', '["new.example"]')
		expect((await loadSettings()).getSettings().blocked).toEqual(['new.example'])
	})

	it('reads the cookies of the former name', async () => {
		writeCookieNow('tureel_sources', 'github.hn')
		writeCookieNow('tureel_theme', 'dark')
		writeCookieNow('tureel_swipe', 'read.unread')
		const settings = await loadSettings()
		expect(settings.enabledIds().slice(0, 2)).toEqual(['github', 'hn'])
		expect(settings.getSettings().theme).toBe('dark')
		expect(settings.getSettings().swipe).toEqual({ left: 'read', right: 'unread' })
		expect(settings.isFirstVisit()).toBe(false)
		expect(cookie('thenews_sources')).toBe('github.hn')
	})

	it('restores the settings from their copy when the cookies are gone', async () => {
		// First visit under the old path: the reader has cookies, and the app keeps a copy.
		writeCookieNow('thenews_sources', 'hn.lobsters')
		writeCookieNow('thenews_theme', 'dark')
		writeCookieNow('thenews_swipe', 'left_read.leftlong_hide')
		await loadSettings()
		// The repository is renamed. The new path sees the stored copy but not the cookies.
		clearCookies()
		const settings = await loadSettings()
		expect(settings.isFirstVisit()).toBe(false)
		expect(settings.enabledIds().slice(0, 2)).toEqual(['hn', 'lobsters'])
		expect(settings.getSettings().theme).toBe('dark')
		expect(settings.getSettings().swipe).toEqual({ left: 'read', leftLong: 'hide' })
	})

	it('keeps the copy in step with later changes', async () => {
		writeCookieNow('thenews_sources', 'hn')
		const first = await loadSettings()
		first.updateSettings({ theme: 'light', newTab: true })
		clearCookies()
		const second = await loadSettings()
		expect(second.getSettings().theme).toBe('light')
		expect(second.getSettings().newTab).toBe(true)
	})

	it('is a first visit when there are neither cookies nor a copy', async () => {
		expect((await loadSettings()).isFirstVisit()).toBe(true)
	})
})
