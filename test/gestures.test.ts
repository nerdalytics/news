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
	SWIPE_LONG_PX,
	SWIPE_MAX_PX,
	SWIPE_SHORT_PX,
	type SwipeSettings,
	startsSwipe,
	swipeAction,
	swipeMoves,
	swipeOffset,
	swipeSlot,
} from '../src/ui/gestures'

describe('swipe', () => {
	const all: SwipeSettings = { left: 'read', leftLong: 'hide', right: 'unread', rightLong: 'block' }

	it('tells short from long swipes by distance', () => {
		expect(swipeSlot(-(SWIPE_SHORT_PX - 1), all)).toBeUndefined()
		expect(swipeSlot(-SWIPE_SHORT_PX, all)).toBe('left')
		expect(swipeSlot(-(SWIPE_LONG_PX - 1), all)).toBe('left')
		expect(swipeSlot(-SWIPE_LONG_PX, all)).toBe('leftLong')
		expect(swipeSlot(SWIPE_SHORT_PX, all)).toBe('right')
		expect(swipeSlot(SWIPE_LONG_PX, all)).toBe('rightLong')
	})

	it('returns the action assigned to the swipe', () => {
		expect(swipeAction(-80, all)).toBe('read')
		expect(swipeAction(-200, all)).toBe('hide')
		expect(swipeAction(80, all)).toBe('unread')
		expect(swipeAction(200, all)).toBe('block')
		expect(swipeAction(0, all)).toBeUndefined()
	})

	it('does nothing when no swipe has an action', () => {
		expect(swipeAction(-200, {})).toBeUndefined()
		expect(swipeAction(200, {})).toBeUndefined()
		expect(swipeMoves(-200, {})).toBe(false)
	})

	it('treats a long movement as the short swipe if the long one has no action', () => {
		expect(swipeAction(-300, { left: 'read' })).toBe('read')
	})

	it('needs the long distance if only the long swipe has an action', () => {
		expect(swipeAction(-100, { leftLong: 'hide' })).toBeUndefined()
		expect(swipeAction(-SWIPE_LONG_PX, { leftLong: 'hide' })).toBe('hide')
	})

	it('moves the row only in a direction that has an action', () => {
		const leftOnly: SwipeSettings = { leftLong: 'comments' }
		expect(swipeMoves(-30, leftOnly)).toBe(true)
		expect(swipeMoves(30, leftOnly)).toBe(false)
		expect(swipeAction(200, leftOnly)).toBeUndefined()
	})

	it('starts only for a clearly horizontal movement beyond the slop', () => {
		expect(startsSwipe(SLOP_PX, 0)).toBe(false)
		expect(startsSwipe(SLOP_PX + 1, 0)).toBe(true)
		expect(startsSwipe(-30, 5)).toBe(true)
		expect(startsSwipe(30, 25)).toBe(false)
		expect(startsSwipe(5, 60)).toBe(false)
	})

	it('moves the row with the finger up to a limit beyond the long distance', () => {
		expect(swipeOffset(-40)).toBe(-40)
		expect(swipeOffset(-500)).toBe(-SWIPE_MAX_PX)
		expect(swipeOffset(500)).toBe(SWIPE_MAX_PX)
		expect(SWIPE_MAX_PX).toBeGreaterThan(SWIPE_LONG_PX)
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
