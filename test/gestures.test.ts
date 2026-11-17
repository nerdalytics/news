import { describe, expect, it } from 'vitest'
import {
	BAR_TOLERANCE_PX,
	BAR_TOP_ZONE_PX,
	barHides,
	PULL_COMMIT_PX,
	PULL_MAX_PX,
	PULL_RESISTANCE,
	pullCommits,
	pullDistance,
	SLOP_PX,
	SWIPE_COMMIT_PX,
	SWIPE_MAX_PX,
	startsSwipe,
	swipeAction,
	swipeCommits,
	swipeOffset,
} from '../src/ui/gestures'

describe('swipe', () => {
	const both = { read: true, unread: true }
	const none = { read: false, unread: false }

	it('maps right to left to read and left to right to unread', () => {
		expect(swipeAction(-80, both)).toBe('read')
		expect(swipeAction(80, both)).toBe('unread')
		expect(swipeAction(0, both)).toBeUndefined()
	})

	it('does nothing for a direction that is switched off', () => {
		expect(swipeAction(-80, none)).toBeUndefined()
		expect(swipeAction(80, none)).toBeUndefined()
		expect(swipeAction(-80, { read: false, unread: true })).toBeUndefined()
		expect(swipeAction(80, { read: false, unread: true })).toBe('unread')
		expect(swipeAction(80, { read: true, unread: false })).toBeUndefined()
	})

	it('starts only for a clearly horizontal movement beyond the slop', () => {
		expect(startsSwipe(SLOP_PX, 0)).toBe(false)
		expect(startsSwipe(SLOP_PX + 1, 0)).toBe(true)
		expect(startsSwipe(-30, 5)).toBe(true)
		expect(startsSwipe(30, 25)).toBe(false)
		expect(startsSwipe(5, 60)).toBe(false)
	})

	it('moves the row with the finger up to a limit', () => {
		expect(swipeOffset(-40)).toBe(-40)
		expect(swipeOffset(-500)).toBe(-SWIPE_MAX_PX)
		expect(swipeOffset(500)).toBe(SWIPE_MAX_PX)
	})

	it('commits at the commit distance in either direction', () => {
		expect(swipeCommits(SWIPE_COMMIT_PX - 1)).toBe(false)
		expect(swipeCommits(SWIPE_COMMIT_PX)).toBe(true)
		expect(swipeCommits(-SWIPE_COMMIT_PX)).toBe(true)
	})
})

describe('pull to refresh', () => {
	it('moves the indicator by a fraction of the finger movement', () => {
		expect(pullDistance(100)).toBe(100 * PULL_RESISTANCE)
	})

	it('never moves up and stops at the limit', () => {
		expect(pullDistance(-50)).toBe(0)
		expect(pullDistance(10_000)).toBe(PULL_MAX_PX)
	})

	it('commits once the indicator reaches the commit distance', () => {
		expect(pullCommits(PULL_COMMIT_PX - 1)).toBe(false)
		expect(pullCommits(PULL_COMMIT_PX)).toBe(true)
		// The limit must lie beyond the commit distance, or a pull could never commit.
		expect(PULL_MAX_PX).toBeGreaterThan(PULL_COMMIT_PX)
	})
})

describe('tab bar', () => {
	const below = BAR_TOP_ZONE_PX + 500

	it('hides on the way down and shows on the way up', () => {
		expect(barHides(BAR_TOLERANCE_PX, below)).toBe(true)
		expect(barHides(-BAR_TOLERANCE_PX, below)).toBe(false)
	})

	it('does not decide on a movement below the tolerance', () => {
		expect(barHides(BAR_TOLERANCE_PX - 1, below)).toBeUndefined()
		expect(barHides(-(BAR_TOLERANCE_PX - 1), below)).toBeUndefined()
	})

	it('stays visible near the top of the page', () => {
		expect(barHides(40, BAR_TOP_ZONE_PX)).toBe(false)
		expect(barHides(40, 20)).toBe(false)
	})
})
