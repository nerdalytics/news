import { describe, expect, it } from 'vitest'
import { capacity, windowStart } from '../src/ui/layout'

describe('capacity', () => {
	const COLUMN_MIN = 352

	it.each([
		[320, 1],
		[390, 1],
		[703, 1],
		[704, 2],
		[1024, 2],
		[1056, 3],
		[1440, 4],
		[1920, 5],
	])('fits a width of %d px with %d columns', (width, columns) => {
		expect(capacity(width, COLUMN_MIN)).toBe(columns)
	})

	it('falls back to one column when a measurement is missing', () => {
		expect(capacity(0, COLUMN_MIN)).toBe(1)
		expect(capacity(1440, Number.NaN)).toBe(1)
		expect(capacity(1440, 0)).toBe(1)
	})
})

describe('windowStart', () => {
	it('starts at the chosen source', () => {
		expect(windowStart(0, 6, 3)).toBe(0)
		expect(windowStart(2, 6, 3)).toBe(2)
		expect(windowStart(4, 9, 1)).toBe(4)
	})

	it('moves back near the end, so the window stays full', () => {
		expect(windowStart(4, 6, 3)).toBe(3)
		expect(windowStart(5, 6, 3)).toBe(3)
	})

	it('starts at the first source when everything fits', () => {
		expect(windowStart(1, 2, 4)).toBe(0)
		expect(windowStart(-1, 0, 3)).toBe(0)
	})
})
