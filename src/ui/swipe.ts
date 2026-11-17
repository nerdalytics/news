import {
	type SwipeAction,
	type SwipeSettings,
	startsSwipe,
	swipeAction,
	swipeCommits,
	swipeOffset,
} from './gestures'

interface SwipeOptions {
	/** Rows inside this element can be swiped. */
	root: HTMLElement
	settings: () => SwipeSettings
	onAction: (row: HTMLElement, action: SwipeAction) => void
}

/** A swipe that ends on a link must not open it. Clicks are ignored for this long afterwards. */
const CLICK_SUPPRESS_MS = 400

/**
 * Horizontal swipes on entries. The rows have `touch-action: pan-y`, so the
 * browser keeps handling vertical scrolling itself and hands horizontal
 * movement to these pointer events. No listener here blocks scrolling.
 */
export function enableSwipe(options: SwipeOptions): void {
	const { root } = options
	let row: HTMLElement | null = null
	let pointer = -1
	let startX = 0
	let startY = 0
	let dx = 0
	let swiping = false
	let suppressClicksUntil = 0

	const enabled = (): boolean => {
		const settings = options.settings()
		return settings.read || settings.unread
	}

	const reset = (): void => {
		if (row) {
			row.style.translate = ''
			row.classList.remove('is-swiping')
			delete row.dataset.swipe
		}
		row = null
		pointer = -1
		swiping = false
	}

	root.addEventListener('pointerdown', (event) => {
		if (event.pointerType === 'mouse' || !event.isPrimary || !enabled()) return
		reset()
		row = (event.target as Element).closest<HTMLElement>('.item[data-url]')
		if (!row) return
		pointer = event.pointerId
		startX = event.clientX
		startY = event.clientY
		dx = 0
	})

	root.addEventListener('pointermove', (event) => {
		if (!row || event.pointerId !== pointer) return
		dx = event.clientX - startX
		if (!swiping) {
			if (!startsSwipe(dx, event.clientY - startY)) return
			swiping = true
			row.classList.add('is-swiping')
			// Keeps the movement with this row when the finger leaves it.
			row.setPointerCapture(pointer)
		}
		const action = swipeAction(dx, options.settings())
		// A direction that is switched off does not move the row.
		row.style.translate = `${action ? swipeOffset(dx) : 0}px 0`
		if (action && swipeCommits(dx)) row.dataset.swipe = action
		else delete row.dataset.swipe
	})

	root.addEventListener('pointerup', (event) => {
		if (!row || event.pointerId !== pointer) return
		const action = swiping && swipeCommits(dx) ? swipeAction(dx, options.settings()) : undefined
		const target = row
		if (swiping) suppressClicksUntil = performance.now() + CLICK_SUPPRESS_MS
		reset()
		if (action) options.onAction(target, action)
	})

	// The browser cancels the pointer when it takes over for vertical scrolling.
	root.addEventListener('pointercancel', reset)

	root.addEventListener(
		'click',
		(event) => {
			if (performance.now() >= suppressClicksUntil) return
			event.preventDefault()
			event.stopPropagation()
		},
		{ capture: true }
	)
}
