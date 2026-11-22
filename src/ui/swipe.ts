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
	root: HTMLElement
	settings: () => SwipeSettings
	applies: (row: HTMLElement, action: SwipeAction) => boolean
	label: (row: HTMLElement, action: SwipeAction) => string
	onAction: (row: HTMLElement, action: SwipeAction) => void
}

const CLICK_SUPPRESS_MS = 400
const SETTLE_MS = 200

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

	const applicable = (): SwipeSettings => {
		const settings = options.settings()
		if (!row) return {}
		const filtered: SwipeSettings = {}
		for (const [slot, action] of Object.entries(settings)) {
			if (action && options.applies(row, action)) filtered[slot as keyof SwipeSettings] = action
		}
		return filtered
	}

	const place = (hint: HTMLElement, anchor: HTMLElement, padded: boolean): void => {
		const rect = anchor.getBoundingClientRect()
		const pad = padded ? getComputedStyle(anchor) : undefined
		const start = rect.left + (pad ? Number.parseFloat(pad.paddingLeft) : 0)
		const end = rect.right - (pad ? Number.parseFloat(pad.paddingRight) : 0)
		const x = dx < 0 ? end - hint.offsetWidth : start
		const rowRect = row?.getBoundingClientRect()
		const y = rowRect
			? rowRect.top + rowRect.height / 2 - document.documentElement.clientHeight / 2
			: 0
		hint.style.setProperty('--hint-x', `${x}px`)
		hint.style.setProperty('--hint-y', `${y}px`)
	}

	const showHint = (action: SwipeAction | undefined): void => {
		if (!row || !column) return
		rowHint.classList.remove('is-visible')
		viewHint.classList.remove('is-visible')
		if (!action) return
		const onColumn = movesSource(action)
		const shown = onColumn ? viewHint : rowHint
		shown.textContent = options.label(row, action)
		if (onColumn) place(shown, column, true)
		else place(shown, row, false)
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
			if (track?.kind === 'source') {
				root.style.setProperty('--swipe-at', `${track.at}px`)
				root.style.setProperty('--swipe-rejoin', `${SWIPE_MAX_PX / (SWIPE_MAX_PX - track.at)}`)
			}
			lastMode = mode
		}
		root.style.setProperty('--dx', `${dx}px`)
		const action = swipeAction(dx, settings)
		if (action !== lastAction) {
			showHint(action)
			lastAction = action
		}
	}

	const cleanup = (): void => {
		clearTimeout(settleTimer)
		delete root.dataset.settling
		delete root.dataset.swipeMode
		root.style.removeProperty('--dx')
		root.style.removeProperty('--swipe-at')
		root.style.removeProperty('--swipe-rejoin')
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

	const release = (commit: boolean): void => {
		if (!row) return
		const settings = applicable()
		const action = commit && swiping ? swipeAction(dx, settings) : undefined
		const target = row
		if (swiping) suppressClicksUntil = performance.now() + CLICK_SUPPRESS_MS
		rowHint.classList.remove('is-visible')
		viewHint.classList.remove('is-visible')
		if (action && movesSource(action)) {
			root.style.setProperty('--dx', `${dx < 0 ? -SWIPE_MAX_PX : SWIPE_MAX_PX}px`)
			void root.offsetWidth
		}
		root.dataset.settling = ''
		root.style.setProperty('--dx', '0px')
		pointer = -1
		swiping = false
		settleTimer = window.setTimeout(cleanup, SETTLE_MS)
		if (action) options.onAction(target, action)
	}

	root.addEventListener('pointerdown', (event) => {
		if (!event.isPrimary || event.button !== 0 || !enabled()) return
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
			row.setPointerCapture(pointer)
		}
		draw()
	})

	root.addEventListener('pointerup', (event) => {
		if (!row || event.pointerId !== pointer) return
		release(true)
	})

	root.addEventListener('pointercancel', () => release(false))

	root.addEventListener('dragstart', (event) => {
		if (enabled()) event.preventDefault()
	})

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
