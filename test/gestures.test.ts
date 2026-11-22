import { describe, expect, it } from 'vitest'
import {
	BAR_BOTTOM_ZONE_PX,
	BAR_TOLERANCE_PX,
	BAR_TOP_ZONE_PX,
	barHides,
	movesSource,
	navDirection,
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
	swipeSlot,
	swipeTrack,
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
		expect(swipeTrack(-200, {})).toBeUndefined()
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
		expect(swipeTrack(-30, leftOnly)).toEqual({ kind: 'row' })
		expect(swipeTrack(30, leftOnly)).toBeUndefined()
		expect(swipeAction(200, leftOnly)).toBeUndefined()
	})

	it('starts only for a clearly horizontal movement beyond the slop', () => {
		expect(startsSwipe(SLOP_PX, 0)).toBe(false)
		expect(startsSwipe(SLOP_PX + 1, 0)).toBe(true)
		expect(startsSwipe(-30, 5)).toBe(true)
		expect(startsSwipe(30, 25)).toBe(false)
		expect(startsSwipe(5, 60)).toBe(false)
	})

	it('keeps the travel limit beyond the long distance', () => {
		expect(SWIPE_MAX_PX).toBeGreaterThan(SWIPE_LONG_PX)
	})

	it('switches the source with the next and previous actions', () => {
		const navigate: SwipeSettings = { left: 'next', right: 'previous' }
		expect(swipeAction(-SWIPE_SHORT_PX, navigate)).toBe('next')
		expect(swipeAction(SWIPE_SHORT_PX, navigate)).toBe('previous')
		expect(swipeTrack(-30, navigate)).toEqual({ kind: 'source', at: SWIPE_SHORT_PX })
	})

	it('marks only next and previous as source actions', () => {
		expect(movesSource('next')).toBe(true)
		expect(movesSource('previous')).toBe(true)
		expect(movesSource('read')).toBe(false)
		expect(movesSource('hide')).toBe(false)
		expect(movesSource('block')).toBe(false)
		expect(movesSource('favorite')).toBe(false)
		expect(movesSource(undefined)).toBe(false)
	})

	it('slides forward to a later source and backward to an earlier one', () => {
		expect(navDirection(0, 3)).toBe('forward')
		expect(navDirection(3, 0)).toBe('backward')
		expect(navDirection(2, 2)).toBe('forward')
	})

	it('decides once per direction what the gesture moves', () => {
		expect(swipeTrack(-30, { left: 'read', leftLong: 'next' })).toEqual({
			kind: 'source',
			at: SWIPE_LONG_PX,
		})
		expect(swipeTrack(30, { right: 'unread', rightLong: 'previous' })).toEqual({
			kind: 'source',
			at: SWIPE_LONG_PX,
		})
		expect(swipeTrack(-30, { leftLong: 'next' })).toEqual({ kind: 'source', at: SWIPE_LONG_PX })
		expect(swipeTrack(30, { right: 'previous', rightLong: 'read' })).toEqual({ kind: 'row' })
		expect(swipeTrack(-30, { left: 'read', leftLong: 'hide' })).toEqual({ kind: 'row' })
		expect(swipeTrack(0, { left: 'next', right: 'read' })).toBeUndefined()
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
		expect(PULL_MAX_PX).toBeGreaterThan(PULL_COMMIT_PX)
	})
})

describe('tab bar', () => {
	const below = BAR_TOP_ZONE_PX + 500
	const farFromEnd = 2000

	it('hides on the way down and shows on the way up', () => {
		expect(barHides(BAR_TOLERANCE_PX, below, farFromEnd)).toBe(true)
		expect(barHides(-BAR_TOLERANCE_PX, below, farFromEnd)).toBe(false)
	})

	it('does not decide on a movement below the tolerance', () => {
		expect(barHides(BAR_TOLERANCE_PX - 1, below, farFromEnd)).toBeUndefined()
		expect(barHides(-(BAR_TOLERANCE_PX - 1), below, farFromEnd)).toBeUndefined()
	})

	it('stays visible near the top of the page', () => {
		expect(barHides(40, BAR_TOP_ZONE_PX, farFromEnd)).toBe(false)
		expect(barHides(40, 20, farFromEnd)).toBe(false)
	})

	it('shows at the end of the page, even while scrolling down', () => {
		expect(barHides(40, below, BAR_BOTTOM_ZONE_PX)).toBe(false)
		expect(barHides(40, below, 0)).toBe(false)
		expect(barHides(2, below, 0)).toBe(false)
		expect(barHides(40, below, BAR_BOTTOM_ZONE_PX + 1)).toBe(true)
	})
})
