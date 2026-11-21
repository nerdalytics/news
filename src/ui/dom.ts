/** Creates an element with an optional class and text content. The browser never parses the text as HTML. */
export function el<K extends keyof HTMLElementTagNameMap>(
	tag: K,
	className?: string,
	text?: string
): HTMLElementTagNameMap[K] {
	const node = document.createElement(tag)
	if (className) node.className = className
	if (text !== undefined) node.textContent = text
	return node
}

const STROKE =
	'viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"'

/** These constant strings are the only values the app assigns to `innerHTML`. */
export const ICONS = {
	grip: `<svg ${STROKE}><path d="M5 9h14M5 15h14"/></svg>`,
	refresh: `<svg ${STROKE}><path d="M20 11a8 8 0 1 0-2.34 5.66"/><path d="M20 4v7h-7"/></svg>`,
	sliders: `<svg ${STROKE}><path d="M4 7h8M18 7h2M4 17h2M12 17h8"/><circle cx="15" cy="7" r="2.5"/><circle cx="9" cy="17" r="2.5"/></svg>`,
} as const

export function icon(name: keyof typeof ICONS): HTMLSpanElement {
	const wrapper = el('span', 'icon')
	wrapper.innerHTML = ICONS[name]
	return wrapper
}

/** Restarts the badge pop on an element so a tap or a tick visibly answers. The
   caller removes `is-tapped` again on animationend. */
export function popBadge(node: HTMLElement): void {
	node.classList.remove('is-tapped')
	// Reflow so a rapid second tap restarts the pop instead of being ignored.
	void node.offsetWidth
	node.classList.add('is-tapped')
}

export function prefersReducedMotion(): boolean {
	return matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** The View Transitions options form, typed locally so the helper works whether
   or not the DOM lib ships it. */
type ViewTransitionDocument = {
	startViewTransition?: (options: { update: () => void; types?: string[] }) => unknown
}

/**
 * Runs a DOM update inside a directional view transition where the browser
 * supports it and the reader allows motion. Otherwise the update runs at once,
 * so the view still changes instantly in older browsers, under reduced motion,
 * or where a browser rejects the options form. The update runs exactly once.
 */
export function slideView(update: () => void, type: 'forward' | 'backward'): void {
	const doc = document as unknown as ViewTransitionDocument
	if (prefersReducedMotion() || typeof doc.startViewTransition !== 'function') {
		update()
		return
	}
	try {
		doc.startViewTransition({ update, types: [type] })
	} catch {
		update()
	}
}

/**
 * Light-dismiss fallback for browsers without `closedby` (Safari). It tests the
 * pointer position rather than the event target, because the dialog is also the
 * target for clicks on its own padding and the gaps between its children. Both
 * the press and the release must land outside, so a text-selection drag that
 * ends on the backdrop does not dismiss the dialog.
 */
export function enableOutsideDismiss(dialog: HTMLDialogElement): void {
	if ('closedBy' in HTMLDialogElement.prototype) return
	const outside = (event: PointerEvent): boolean => {
		const rect = dialog.getBoundingClientRect()
		return (
			event.clientX < rect.left ||
			event.clientX > rect.right ||
			event.clientY < rect.top ||
			event.clientY > rect.bottom
		)
	}
	let pressedOutside = false
	dialog.addEventListener('pointerdown', (event) => {
		pressedOutside = outside(event)
	})
	dialog.addEventListener('pointerup', (event) => {
		if (pressedOutside && outside(event)) dialog.close()
	})
}

/** The task runs after this long even if the browser never becomes idle. */
const IDLE_TIMEOUT_MS = 1500
/** Safari has no `requestIdleCallback`. There the task runs after this delay. */
const IDLE_FALLBACK_MS = 200

/** Runs a task when the browser is idle. */
export function whenIdle(task: () => void): void {
	if ('requestIdleCallback' in window) requestIdleCallback(task, { timeout: IDLE_TIMEOUT_MS })
	else setTimeout(task, IDLE_FALLBACK_MS)
}
