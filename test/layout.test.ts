import { describe, expect, it } from 'vitest'
import { capacity, windowStart, windowStep } from '../src/ui/layout'

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

describe('windowStep', () => {
	it('moves the whole view one source in each direction', () => {
		expect(windowStep(2, 6, 2, 1)).toBe(3)
		expect(windowStep(2, 6, 2, -1)).toBe(1)
		expect(windowStep(2, 6, 1, 1)).toBe(3)
		expect(windowStep(2, 6, 1, -1)).toBe(1)
	})

	it('moves the view even when the swipe starts in a later column', () => {
		// The deck steps from the first displayed source, not from the swiped one.
		// With sources 2, 3 and 4 displayed, a previous swipe in the right column
		// must move the view to 1, not land on 3, which is already displayed.
		expect(windowStep(2, 9, 3, -1)).toBe(1)
	})

	it('wraps around the ends instead of staying on the last window', () => {
		// The last full window shows sources 4 and 5; next wraps to the first.
		expect(windowStep(4, 6, 2, 1)).toBe(0)
		expect(windowStep(5, 6, 2, 1)).toBe(0)
		expect(windowStep(0, 6, 2, -1)).toBe(4)
		expect(windowStep(4, 6, 1, 1)).toBe(5)
		expect(windowStep(5, 6, 1, 1)).toBe(0)
		expect(windowStep(0, 6, 1, -1)).toBe(5)
	})

	it('stays at the first source when everything fits', () => {
		expect(windowStep(1, 2, 4, 1)).toBe(0)
		expect(windowStep(1, 2, 4, -1)).toBe(0)
		expect(windowStep(0, 1, 1, 1)).toBe(0)
	})
})
