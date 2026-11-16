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

export function prefersReducedMotion(): boolean {
	return matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Runs a DOM change inside a cross-fade in browsers that support View Transitions. */
export function withTransition(change: () => void): void {
	if (!document.startViewTransition || prefersReducedMotion()) {
		change()
		return
	}
	document.startViewTransition(change)
}

/** Runs a task when the browser is idle. Safari has no `requestIdleCallback`, so there the task runs after 200 ms. */
export function whenIdle(task: () => void): void {
	if ('requestIdleCallback' in window) requestIdleCallback(task, { timeout: 1500 })
	else setTimeout(task, 200)
}
