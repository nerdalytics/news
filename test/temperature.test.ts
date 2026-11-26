import { beforeEach, describe, expect, it } from 'vitest'
import { recordRead, sortByTemperature, temperature, WINDOWS } from '../src/temperature'

const HOUR = 3_600_000

beforeEach(() => {
	localStorage.clear()
})

describe('temperature', () => {
	it('starts at zero for an unseen source', () => {
		expect(temperature('hn', 'day', 0)).toBe(0)
	})

	it('adds one unit of heat per read', () => {
		recordRead('hn', 0)
		recordRead('hn', 0)
		expect(temperature('hn', 'hour', 0)).toBe(2)
	})

	it('halves after one half-life of the window', () => {
		recordRead('hn', 0)
		expect(temperature('hn', 'hour', HOUR)).toBeCloseTo(0.5)
		expect(temperature('hn', 'hour', 2 * HOUR)).toBeCloseTo(0.25)
	})

	it('cools faster in shorter windows', () => {
		recordRead('hn', 0)
		expect(temperature('hn', 'hour', HOUR)).toBeLessThan(temperature('hn', 'day', HOUR))
	})

	it('all-time never cools', () => {
		recordRead('hn', 0)
		expect(temperature('hn', 'all', 100 * 365 * 24 * HOUR)).toBe(1)
	})

	it('keeps sources independent', () => {
		recordRead('hn', 0)
		recordRead('github', 0)
		recordRead('github', 0)
		expect(temperature('github', 'day', 0)).toBe(2)
		expect(temperature('hn', 'day', 0)).toBe(1)
	})

	it('sorts hottest first', () => {
		recordRead('hn', 0)
		recordRead('github', 0)
		recordRead('github', 0)
		expect(sortByTemperature(['hn', 'github'], 'day', 0)).toEqual(['github', 'hn'])
	})

	it('persists across reloads', () => {
		recordRead('hn', 0)
		expect(temperature('hn', 'day', 0)).toBe(1)
	})

	it('exposes seven windows', () => {
		expect(WINDOWS).toHaveLength(7)
	})
})
