import { beforeEach, describe, expect, it, vi } from 'vitest'

async function load(): Promise<typeof import('../src/hidden')> {
	vi.resetModules()
	return import('../src/hidden')
}

describe('hidden entries', () => {
	beforeEach(() => {
		localStorage.clear()
	})

	it('remembers a hidden entry across page loads', async () => {
		const first = await load()
		first.hide('https://example.com/a')
		expect(first.isHidden('https://example.com/a')).toBe(true)
		const second = await load()
		expect(second.isHidden('https://example.com/a')).toBe(true)
		expect(second.hiddenCount()).toBe(1)
	})

	it('shows everything again on request', async () => {
		const hidden = await load()
		hidden.hide('https://example.com/a')
		hidden.hide('https://example.com/b')
		hidden.showAllHidden()
		expect(hidden.hiddenCount()).toBe(0)
		expect(hidden.isHidden('https://example.com/a')).toBe(false)
		expect((await load()).hiddenCount()).toBe(0)
	})
})
