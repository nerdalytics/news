import { barHides } from './gestures'

export interface AutoHideBar {
	/** Shows the bar and forgets the scroll movement so far. Call after the app itself scrolled the page. */
	reset(): void
}

/** Hides the bar while the reader scrolls down and shows it again on the way up. */
export function autoHideBar(bar: HTMLElement): AutoHideBar {
	/** The scroll position at the last decision. */
	let anchor = scrollY
	let scheduled = false

	const show = (): void => bar.classList.remove('is-hidden')

	const update = (): void => {
		scheduled = false
		// iOS reports positions beyond both ends while the page bounces. Ignore those.
		const last = document.documentElement.scrollHeight - innerHeight
		const y = Math.max(0, Math.min(scrollY, last))
		const hides = barHides(y - anchor, y)
		if (hides === undefined) return
		anchor = y
		bar.classList.toggle('is-hidden', hides)
	}

	// One decision per frame is enough, however many scroll events arrive.
	addEventListener(
		'scroll',
		() => {
			if (scheduled) return
			scheduled = true
			requestAnimationFrame(update)
		},
		{ passive: true }
	)
	// Keyboard focus must never land on a control that is off screen.
	bar.addEventListener('focusin', show)

	return {
		reset() {
			anchor = scrollY
			show()
		},
	}
}
