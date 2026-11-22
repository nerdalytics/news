import { barHides } from './gestures'

export interface AutoHideBar {
	reset(): void
}

export function autoHideBar(bar: HTMLElement): AutoHideBar {
	let anchor = scrollY
	let scheduled = false

	const show = (): void => bar.classList.remove('is-hidden')

	const update = (): void => {
		scheduled = false
		const last = document.documentElement.scrollHeight - innerHeight
		const y = Math.max(0, Math.min(scrollY, last))
		const hides = barHides(y - anchor, y, last - y)
		if (hides === undefined) return
		anchor = y
		bar.classList.toggle('is-hidden', hides)
	}

	addEventListener(
		'scroll',
		() => {
			if (scheduled) return
			scheduled = true
			requestAnimationFrame(update)
		},
		{ passive: true }
	)
	bar.addEventListener('focusin', show)

	return {
		reset() {
			anchor = scrollY
			show()
		},
	}
}
