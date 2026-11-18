import { el } from './dom'
import {
	movesSource,
	SWIPE_MAX_PX,
	type SwipeAction,
	type SwipeSettings,
	startsSwipe,
	swipeAction,
	swipeTrack,
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
/** Longer than the release glide (--fast), so the cleanup never cuts it short. */
const SETTLE_MS = 200

/**
 * Horizontal swipes on entries. The rows have `touch-action: pan-y`, so the
 * browser keeps handling vertical scrolling itself and hands horizontal
 * movement to these pointer events. No listener here blocks scrolling.
 *
 * The script does not move anything. It writes one value, --dx, the finger's
 * distance, and the styles derive every offset from it with calc alone: the
 * row content follows it directly, and a swipe whose far action switches the
 * source hands over to the whole view at that action's distance — the view
 * follows the further travel while the row slides back, all in the same frame.
 * Because nothing transitions while the finger is down, no layer can lag
 * behind another and smear into a double image, and the handover works the
 * same in both directions. On release the deck transitions --dx itself back
 * to zero, the one movement that may animate, and every part glides home
 * together.
 *
 * Two labels name the action the swipe would carry out: one anchored to the
 * row, one centered on the screen for a source swipe. Each is placed once
 * when its anchor appears; only their opacity crossfades, so a label never
 * chases a position either.
 */
export function enableSwipe(options: SwipeOptions): void {
	const { root } = options
	root.style.setProperty('--swipe-max', `${SWIPE_MAX_PX}px`)
	const rowHint = el('span', 'swipe-hint')
	const viewHint = el('span', 'swipe-hint')
	for (const hint of [rowHint, viewHint]) hint.setAttribute('aria-hidden', 'true')

	let row: HTMLElement | null = null
	let column: HTMLElement | null = null
	let pointer = -1
	let startX = 0
	let startY = 0
	let dx = 0
	let swiping = false
	let suppressClicksUntil = 0
	let lastMode: string | undefined
	let lastAction: SwipeAction | undefined
	let settleTimer = 0

	const enabled = (): boolean => Object.values(options.settings()).some(Boolean)

	/** The settings without the actions that make no sense for this row. */
	const applicable = (): SwipeSettings => {
		const settings = options.settings()
		if (!row) return {}
		const filtered: SwipeSettings = {}
		for (const [slot, action] of Object.entries(settings)) {
			if (action && options.applies(row, action)) filtered[slot as keyof SwipeSettings] = action
		}
		return filtered
	}

	/** Places a hint at the near or far edge of its anchor, by the swipe direction. */
	const place = (
		hint: HTMLElement,
		anchor: HTMLElement,
		padded: boolean,
		centered: boolean
	): void => {
		const rect = anchor.getBoundingClientRect()
		const pad = padded ? getComputedStyle(anchor) : undefined
		const start = rect.left + (pad ? Number.parseFloat(pad.paddingLeft) : 0)
		const end = rect.right - (pad ? Number.parseFloat(pad.paddingRight) : 0)
		const x = dx < 0 ? end - hint.offsetWidth : start
		// A view swipe centers the label on the screen, a row swipe on the row.
		const y = centered ? 0 : rect.top + rect.height / 2 - document.documentElement.clientHeight / 2
		hint.style.setProperty('--hint-x', `${x}px`)
		hint.style.setProperty('--hint-y', `${y}px`)
	}

	/** Shows the label of the current action on its hint and hides the other. */
	const showHint = (action: SwipeAction | undefined): void => {
		if (!row || !column) return
		rowHint.classList.remove('is-visible')
		viewHint.classList.remove('is-visible')
		if (!action) return
		const onColumn = movesSource(action)
		const shown = onColumn ? viewHint : rowHint
		shown.textContent = options.label(row, action)
		if (onColumn) place(shown, column, true, true)
		else place(shown, row, false, false)
		shown.classList.add('is-visible')
	}

	const draw = (): void => {
		if (!row || !column) return
		const settings = applicable()
		const track = swipeTrack(dx, settings)
		const mode = track && (track.kind === 'row' ? 'row' : dx < 0 ? 'source-left' : 'source-right')
		if (mode !== lastMode) {
			if (mode) root.dataset.swipeMode = mode
			else delete root.dataset.swipeMode
			if (track?.kind === 'source') root.style.setProperty('--swipe-at', `${track.at}px`)
			lastMode = mode
		}
		root.style.setProperty('--dx', `${dx}px`)
		const action = swipeAction(dx, settings)
		if (action !== lastAction) {
			showHint(action)
			lastAction = action
		}
	}

	/** Ends the gesture state and takes the hints and derived offsets away. */
	const cleanup = (): void => {
		clearTimeout(settleTimer)
		delete root.dataset.settling
		delete root.dataset.swipeMode
		root.style.removeProperty('--dx')
		root.style.removeProperty('--swipe-at')
		row?.removeAttribute('data-swiping')
		rowHint.remove()
		viewHint.remove()
		rowHint.classList.remove('is-visible')
		viewHint.classList.remove('is-visible')
		row = null
		column = null
		pointer = -1
		swiping = false
		lastMode = undefined
		lastAction = undefined
	}

	/**
	 * Lets go. The deck animates --dx back to zero and every derived offset
	 * glides home with it; the state stays until that glide is over, so a
	 * follow-up gesture can interrupt it cleanly.
	 */
	const release = (commit: boolean): void => {
		if (!row) return
		const settings = applicable()
		const action = commit && swiping ? swipeAction(dx, settings) : undefined
		const target = row
		if (swiping) suppressClicksUntil = performance.now() + CLICK_SUPPRESS_MS
		rowHint.classList.remove('is-visible')
		viewHint.classList.remove('is-visible')
		root.dataset.settling = ''
		root.style.setProperty('--dx', '0px')
		pointer = -1
		swiping = false
		settleTimer = window.setTimeout(cleanup, SETTLE_MS)
		if (action) options.onAction(target, action)
	}

	root.addEventListener('pointerdown', (event) => {
		if (event.pointerType === 'mouse' || !event.isPrimary || !enabled()) return
		// The previous gesture may still be gliding home; start from a clean state.
		cleanup()
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
			row.dataset.swiping = ''
			root.append(rowHint, viewHint)
			// Keeps the movement with this row when the finger leaves it.
			row.setPointerCapture(pointer)
		}
		draw()
	})

	root.addEventListener('pointerup', (event) => {
		if (!row || event.pointerId !== pointer) return
		release(true)
	})

	// The browser cancels the pointer when it takes over for vertical scrolling.
	root.addEventListener('pointercancel', () => release(false))

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
