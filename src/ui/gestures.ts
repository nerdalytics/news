/**
 * The numbers and decisions behind the touch gestures. They are kept apart
 * from the event handling, so that they can be tested without a browser.
 */

/** What a swipe can do. Most actions act on an entry; `next` and `previous` switch the source. */
export const SWIPE_ACTIONS = [
	'read',
	'unread',
	'block',
	'favorite',
	'comments',
	'hide',
	'browser',
	'next',
	'previous',
] as const
export type SwipeAction = (typeof SWIPE_ACTIONS)[number]

/** True for the actions that move the whole column instead of a single row. */
export function movesSource(action: SwipeAction | undefined): boolean {
	return action === 'next' || action === 'previous'
}

/** The slide direction when the view moves from one source index to another. */
export function navDirection(from: number, to: number): 'forward' | 'backward' {
	return to >= from ? 'forward' : 'backward'
}

/** The four swipes: two directions, each short or long. */
export const SWIPE_SLOTS = ['left', 'leftLong', 'right', 'rightLong'] as const
export type SwipeSlot = (typeof SWIPE_SLOTS)[number]

/** The action assigned to each swipe. A swipe without an action does nothing. */
export type SwipeSettings = Partial<Record<SwipeSlot, SwipeAction>>

/** A finger that moved less than this has not started a gesture. */
export const SLOP_PX = 10
/** A swipe starts only if it is this many times more horizontal than vertical. */
export const SWIPE_DOMINANCE = 1.5
/** Lifting the finger after this distance carries out the short swipe. */
export const SWIPE_SHORT_PX = 64
/** Lifting the finger after this distance carries out the long swipe. */
export const SWIPE_LONG_PX = 160
/** The row and the view follow the finger up to this distance. */
export const SWIPE_MAX_PX = 208

export function startsSwipe(dx: number, dy: number): boolean {
	return Math.abs(dx) > SLOP_PX && Math.abs(dx) > Math.abs(dy) * SWIPE_DOMINANCE
}

/**
 * The swipe a finger movement of `dx` stands for right now. A movement past
 * the long distance counts as the long swipe if that has an action, and as the
 * short swipe otherwise.
 */
export function swipeSlot(dx: number, settings: SwipeSettings): SwipeSlot | undefined {
	const distance = Math.abs(dx)
	const [short, long]: [SwipeSlot, SwipeSlot] =
		dx < 0 ? ['left', 'leftLong'] : ['right', 'rightLong']
	if (distance >= SWIPE_LONG_PX && settings[long]) return long
	if (distance >= SWIPE_SHORT_PX && settings[short]) return short
	return undefined
}

export function swipeAction(dx: number, settings: SwipeSettings): SwipeAction | undefined {
	const slot = swipeSlot(dx, settings)
	return slot && settings[slot]
}

/**
 * What a swipe in the direction of `dx` moves, decided once per direction so
 * the motion never changes target mid-gesture. The far action decides: if it
 * switches the source, the view takes over at that action's distance (`at`);
 * otherwise the row follows the finger. A direction without any action moves
 * nothing.
 */
export type SwipeTrack = { kind: 'row' } | { kind: 'source'; at: number } | undefined

export function swipeTrack(dx: number, settings: SwipeSettings): SwipeTrack {
	if (dx === 0) return undefined
	const [short, long]: [SwipeSlot, SwipeSlot] =
		dx < 0 ? ['left', 'leftLong'] : ['right', 'rightLong']
	if (settings[long] && movesSource(settings[long])) return { kind: 'source', at: SWIPE_LONG_PX }
	// A lone short source action hands over at the short distance. With a row
	// action beyond it, the row keeps following; the short action still commits.
	if (settings[short] && movesSource(settings[short]) && !settings[long])
		return { kind: 'source', at: SWIPE_SHORT_PX }
	if (settings[short] || settings[long]) return { kind: 'row' }
	return undefined
}

/** The indicator moves this fraction of the finger's distance. */
export const PULL_RESISTANCE = 0.5
/** Releasing the indicator at or below this distance refreshes. */
export const PULL_COMMIT_PX = 64
/** The indicator stops here. */
export const PULL_MAX_PX = 96

/** How far the indicator has come down for a finger movement of `dy`. */
export function pullDistance(dy: number): number {
	return Math.max(0, Math.min(PULL_MAX_PX, dy * PULL_RESISTANCE))
}

export function pullCommits(distance: number): boolean {
	return distance >= PULL_COMMIT_PX
}

/** The bar ignores scroll movements shorter than this, so it does not flicker. */
export const BAR_TOLERANCE_PX = 8
/** The bar is always shown this close to the top of the page. */
export const BAR_TOP_ZONE_PX = 64
/** The bar is shown again once the page is this close to its end. */
export const BAR_BOTTOM_ZONE_PX = 24

/**
 * Whether the tab bar hides after the page scrolled by `delta` pixels to the
 * position `y`, with `toBottom` pixels left below. Returns nothing while the
 * movement is too small to decide.
 */
export function barHides(delta: number, y: number, toBottom: number): boolean | undefined {
	// At the end of the page there is nothing left to read, so the bar comes back.
	if (toBottom <= BAR_BOTTOM_ZONE_PX) return false
	if (Math.abs(delta) < BAR_TOLERANCE_PX) return undefined
	return delta > 0 && y > BAR_TOP_ZONE_PX
}
