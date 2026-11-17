import { el } from './dom'
import {
	type SwipeAction,
	type SwipeSettings,
	startsSwipe,
	swipeAction,
	swipeMoves,
	swipeOffset,
} from './gestures'

interface SwipeOptions {
	/** Rows inside this element can be swiped. */
	root: HTMLElement
	settings: () => SwipeSettings
	/** False if the action makes no sense for this row, for example comments on a row without any. */
	applies: (row: HTMLElement, action: SwipeAction) => boolean
	/** The words shown behind the row while the swipe would carry out this action. */
	label: (row: HTMLElement, action: SwipeAction) => string
	onAction: (row: HTMLElement, action: SwipeAction) => void
}

/** A swipe that ends on a link must not open it. Clicks are ignored for this long afterwards. */
const CLICK_SUPPRESS_MS = 400

/**
 * Horizontal swipes on entries. The rows have `touch-action: pan-y`, so the
 * browser keeps handling vertical scrolling itself and hands horizontal
 * movement to these pointer events. No listener here blocks scrolling.
 *
 * The content of the row follows the finger. Behind it a label names the
 * action the swipe would carry out if the finger lifted now. The label changes
 * when the finger passes from the short to the long distance.
 */
export function enableSwipe(options: SwipeOptions): void {
	const { root } = options
	const hint = el('span', 'swipe-hint')
	hint.setAttribute('aria-hidden', 'true')
	let row: HTMLElement | null = null
	let pointer = -1
	let startX = 0
	let startY = 0
	let dx = 0
	let swiping = false
	let suppressClicksUntil = 0

	const enabled = (): boolean => Object.values(options.settings()).some(Boolean)

	/** The action for the current finger position, if it applies to this row. */
	const current = (): SwipeAction | undefined => {
		const action = swipeAction(dx, options.settings())
		return row && action && options.applies(row, action) ? action : undefined
	}

	const reset = (): void => {
		if (row) {
			row.style.removeProperty('--swipe')
			row.classList.remove('is-swiping')
			delete row.dataset.swipe
		}
		hint.remove()
		row = null
		pointer = -1
		swiping = false
	}

	const draw = (): void => {
		if (!row) return
		const moves = swipeMoves(dx, options.settings())
		row.style.setProperty('--swipe', `${moves ? swipeOffset(dx) : 0}px`)
		const action = current()
		hint.textContent = action ? options.label(row, action) : ''
		// The label sits on the side the content moved away from.
		hint.dataset.side = dx < 0 ? 'end' : 'start'
		if (action) row.dataset.swipe = action
		else delete row.dataset.swipe
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
			row.append(hint)
			// Keeps the movement with this row when the finger leaves it.
			row.setPointerCapture(pointer)
		}
		draw()
	})

	root.addEventListener('pointerup', (event) => {
		if (!row || event.pointerId !== pointer) return
		const action = swiping ? current() : undefined
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
