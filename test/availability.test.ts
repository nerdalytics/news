import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sourceById } from '../src/sources/index'

const HOUR = 60 * 60 * 1000
const lobsters = sourceById('lobsters')!
const hn = sourceById('hn')!

/** The module keeps its state in memory, so every test loads a fresh copy. */
async function load(): Promise<typeof import('../src/availability')> {
	vi.resetModules()
	return import('../src/availability')
}

describe('availability of sources', () => {
	beforeEach(() => {
		localStorage.clear()
	})

	it('always lists a direct source', async () => {
		expect((await load()).isAvailable(hn)).toBe(true)
	})

	it('hides a hosted source until a feed has been read', async () => {
		const availability = await load()
		expect(availability.isAvailable(lobsters)).toBe(false)
		availability.setGeneratedAt('lobsters', Date.now() - HOUR)
		expect(availability.isAvailable(lobsters)).toBe(true)
	})

	it('remembers the state across page loads', async () => {
		;(await load()).setGeneratedAt('lobsters', Date.now() - HOUR)
		expect((await load()).isAvailable(lobsters)).toBe(true)
	})

	it('hides a hosted source whose feed is older than the limit', async () => {
		const availability = await load()
		availability.setGeneratedAt('lobsters', Date.now() - availability.HOSTED_MAX_AGE_MS - HOUR)
		expect(availability.isAvailable(lobsters)).toBe(false)
	})

	it('hides a hosted source again when its feed is gone', async () => {
		const availability = await load()
		availability.setGeneratedAt('lobsters', Date.now())
		availability.setGeneratedAt('lobsters', undefined)
		expect(availability.isAvailable(lobsters)).toBe(false)
	})

	it('reports only changes between available and hidden', async () => {
		const availability = await load()
		const listener = vi.fn()
		availability.onAvailabilityChange(listener)
		availability.setGeneratedAt('lobsters', Date.now() - HOUR)
		expect(listener).toHaveBeenCalledTimes(1)
		// A newer feed of a source that is already listed changes nothing on screen.
		availability.setGeneratedAt('lobsters', Date.now())
		expect(listener).toHaveBeenCalledTimes(1)
		availability.setGeneratedAt('lobsters', undefined)
		expect(listener).toHaveBeenCalledTimes(2)
	})
})
