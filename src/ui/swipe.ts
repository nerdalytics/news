import { el } from './dom'
import {
	movesSource,
	type SwipeAction,
	type SwipeSettings,
	startsSwipe,
	swipeAction,
	swipeMoves,
	swipeOffset,
	swipePending,
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
 *
 * A swipe that switches the source moves the whole view instead — every
 * displayed column travels together — with the label behind the view. The
 * target follows the current action, so a gesture can pass from a row action
 * to a source action and back. The styles glide between the two targets, and
 * the label glides to its new place, instead of jumping.
 *
 * While a target follows the finger, nothing may animate toward it: a CSS
 * transition chases each new value instead of landing on it, so the content
 * trails the finger and smears into a double image while the hand moves.
 * During the drag the followed element therefore carries `is-swiping`, which
 * keeps its transitions at 0s; only the element that is *not* followed keeps
 * its short glide, so it settles as the other takes over. When the finger
 * lifts, the class goes away before the offset resets, and the return home is
 * the one movement that may animate.
 */
export function enableSwipe(options: SwipeOptions): void {
	const { root } = options
	const hint = el('span', 'swipe-hint')
	hint.setAttribute('aria-hidden', 'true')
	let row: HTMLElement | null = null
	let column: HTMLElement | null = null
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

	const clearRow = (): void => {
		if (!row) return
		row.classList.remove('is-swiping')
		row.style.removeProperty('--swipe')
		delete row.dataset.swipe
	}

	const clearView = (): void => {
		root.classList.remove('is-swiping')
		root.style.removeProperty('--col-swipe')
		delete root.dataset.swipe
	}

	/**
	 * The label is fixed and placed by translate alone, so every change of
	 * place — the side, the row, or row to view — is a movement the styles can
	 * transition. It stays in the root for the whole gesture; moving it between
	 * parents would restart it instantly.
	 */
	const placeHint = (onColumn: boolean): void => {
		if (!row || !column) return
		const anchor = onColumn ? column : row
		const rect = anchor.getBoundingClientRect()
		// The column's content sits inside its gutter; the row already spans the content.
		const pad = onColumn ? getComputedStyle(column) : undefined
		const start = rect.left + (pad ? Number.parseFloat(pad.paddingLeft) : 0)
		const end = rect.right - (pad ? Number.parseFloat(pad.paddingRight) : 0)
		const x = dx < 0 ? end - hint.offsetWidth : start
		// A view swipe centers the label on the screen, a row swipe on the row.
		const y = onColumn ? 0 : rect.top + rect.height / 2 - document.documentElement.clientHeight / 2
		hint.style.setProperty('--hint-x', `${x}px`)
		hint.style.setProperty('--hint-y', `${y}px`)
	}

	const reset = (): void => {
		clearRow()
		clearView()
		hint.remove()
		hint.style.removeProperty('--hint-x')
		hint.style.removeProperty('--hint-y')
		row = null
		column = null
		pointer = -1
		swiping = false
	}

	const draw = (): void => {
		if (!row || !column) return
		const settings = options.settings()
		const moves = swipeMoves(dx, settings)
		const action = current()
		// Before a threshold is reached, the first action of the direction decides what moves.
		const onColumn = movesSource(action ?? swipePending(dx, settings))
		const offset = `${moves ? swipeOffset(dx) : 0}px`
		const target = onColumn ? root : row
		// Only the followed element carries is-swiping, which pins it to the finger.
		if (onColumn) clearRow()
		else clearView()
		target.classList.add('is-swiping')
		target.style.setProperty(onColumn ? '--col-swipe' : '--swipe', offset)
		if (hint.parentElement !== root) root.append(hint)
		hint.textContent = action ? options.label(row, action) : ''
		placeHint(onColumn)
		if (action) target.dataset.swipe = action
		else delete target.dataset.swipe
	}

	root.addEventListener('pointerdown', (event) => {
		if (event.pointerType === 'mouse' || !event.isPrimary || !enabled()) return
		// The previous gesture may still be gliding home; start from a clean state.
		clearRow()
		clearView()
		hint.remove()
		row = (event.target as Element).closest<HTMLElement>('.item[data-url]')
		if (!row) return
		column = row.closest<HTMLElement>('.column')
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
			root.classList.add('is-swiping')
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
