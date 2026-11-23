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

export const SWIPE_LABELS: Record<SwipeAction, string> = {
	block: 'Block',
	browser: 'Browser',
	comments: 'Comments',
	favorite: 'Favorite',
	hide: 'Hide',
	next: 'Next',
	previous: 'Previous',
	read: 'Read',
	unread: 'Unread',
}

export const SWIPE_DESCRIPTIONS: Record<SwipeAction, string> = {
	block: 'Block site',
	browser: 'Open in browser',
	comments: 'Comments',
	favorite: 'Favorite',
	hide: 'Hide entry',
	next: 'Next source',
	previous: 'Previous source',
	read: 'Mark read',
	unread: 'Mark unread',
}

export function movesSource(action: SwipeAction | undefined): boolean {
	return action === 'next' || action === 'previous'
}

export function navDirection(from: number, to: number): 'forward' | 'backward' {
	return to >= from ? 'forward' : 'backward'
}

export const SWIPE_SLOTS = ['left', 'leftLong', 'right', 'rightLong'] as const
export type SwipeSlot = (typeof SWIPE_SLOTS)[number]

export type SwipeSettings = Partial<Record<SwipeSlot, SwipeAction>>

export const SLOP_PX = 10
export const SWIPE_DOMINANCE = 1.5
export const SWIPE_SHORT_PX = 64
export const SWIPE_LONG_PX = 160
export const SWIPE_MAX_PX = 208

export function startsSwipe(dx: number, dy: number): boolean {
	return Math.abs(dx) > SLOP_PX && Math.abs(dx) > Math.abs(dy) * SWIPE_DOMINANCE
}

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

export type SwipeTrack = { kind: 'row' } | { kind: 'source'; at: number } | undefined

export function swipeTrack(dx: number, settings: SwipeSettings): SwipeTrack {
	if (dx === 0) return undefined
	const [short, long]: [SwipeSlot, SwipeSlot] =
		dx < 0 ? ['left', 'leftLong'] : ['right', 'rightLong']
	if (settings[long] && movesSource(settings[long])) return { kind: 'source', at: SWIPE_LONG_PX }
	if (settings[short] && movesSource(settings[short]) && !settings[long])
		return { kind: 'source', at: SWIPE_SHORT_PX }
	if (settings[short] || settings[long]) return { kind: 'row' }
	return undefined
}

export const PULL_RESISTANCE = 0.5
export const PULL_COMMIT_PX = 64
export const PULL_MAX_PX = 96

export function pullDistance(dy: number): number {
	return Math.max(0, Math.min(PULL_MAX_PX, dy * PULL_RESISTANCE))
}

export function pullCommits(distance: number): boolean {
	return distance >= PULL_COMMIT_PX
}

export const BAR_TOLERANCE_PX = 8
export const BAR_TOP_ZONE_PX = 64
export const BAR_BOTTOM_ZONE_PX = 24

export function barHides(delta: number, y: number, toBottom: number): boolean | undefined {
	if (toBottom <= BAR_BOTTOM_ZONE_PX) return false
	if (Math.abs(delta) < BAR_TOLERANCE_PX) return undefined
	return delta > 0 && y > BAR_TOP_ZONE_PX
}
