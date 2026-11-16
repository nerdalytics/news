/**
 * The numbers and decisions behind the three touch gestures. They are kept
 * apart from the event handling, so that they can be tested without a browser.
 */

export interface SwipeSettings {
	/** A swipe from right to left marks an entry as read. */
	read: boolean
	/** A swipe from left to right marks an entry as unread. */
	unread: boolean
}

export type SwipeAction = 'read' | 'unread'

/** A finger that moved less than this has not started a gesture. */
export const SLOP_PX = 10
/** A swipe starts only if it is this many times more horizontal than vertical. */
export const SWIPE_DOMINANCE = 1.5
/** Lifting the finger after this distance carries out the swipe. */
export const SWIPE_COMMIT_PX = 72
/** The row follows the finger up to this distance. */
export const SWIPE_MAX_PX = 112

/** The action a horizontal movement stands for, or nothing if that direction is switched off. */
export function swipeAction(dx: number, settings: SwipeSettings): SwipeAction | undefined {
	if (dx < 0 && settings.read) return 'read'
	if (dx > 0 && settings.unread) return 'unread'
	return undefined
}

export function startsSwipe(dx: number, dy: number): boolean {
	return Math.abs(dx) > SLOP_PX && Math.abs(dx) > Math.abs(dy) * SWIPE_DOMINANCE
}

/** How far the row moves for a finger movement of `dx`. */
export function swipeOffset(dx: number): number {
	return Math.max(-SWIPE_MAX_PX, Math.min(SWIPE_MAX_PX, dx))
}

export function swipeCommits(dx: number): boolean {
	return Math.abs(dx) >= SWIPE_COMMIT_PX
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

/**
 * Whether the tab bar hides after the page scrolled by `delta` pixels to the
 * position `y`. Returns nothing while the movement is too small to decide.
 */
export function barHides(delta: number, y: number): boolean | undefined {
	if (Math.abs(delta) < BAR_TOLERANCE_PX) return undefined
	return delta > 0 && y > BAR_TOP_ZONE_PX
}
