import { el, icon } from './dom'
import { PULL_COMMIT_PX, pullCommits, pullDistance, SLOP_PX } from './gestures'

interface PullOptions {
	/** Touches that start inside this element can pull. */
	root: HTMLElement
	/** Refreshes the column the pull started in. The indicator spins until the promise settles. */
	onRefresh: (column: HTMLElement) => Promise<void>
}

/**
 * Pull to refresh. A pull that starts at the top of the page brings down an
 * indicator. Releasing it far enough refreshes the column under the finger.
 *
 * The `touchmove` listener has to be able to cancel the browser's own
 * overscroll, so it cannot be passive. It is attached only while a touch that
 * started at the top of the page is down. Scrolling anywhere else runs
 * without it.
 */
export function enablePullToRefresh(options: PullOptions): void {
	const indicator = el('div', 'pull')
	indicator.setAttribute('aria-hidden', 'true')
	indicator.append(icon('refresh'))
	// While a feed loads, the indicator waits where a pull commits.
	indicator.style.setProperty('--pull-rest', `${PULL_COMMIT_PX}px`)
	document.body.append(indicator)

	let column: HTMLElement | null = null
	let startX = 0
	let startY = 0
	let distance = 0
	let pulling = false
	let refreshing = false

	const place = (value: number): void => {
		distance = value
		indicator.style.setProperty('--pull', `${value}px`)
		indicator.classList.toggle('is-ready', pullCommits(value))
	}

	const release = (): void => {
		options.root.removeEventListener('touchmove', onMove)
		options.root.removeEventListener('touchend', onEnd)
		options.root.removeEventListener('touchcancel', onEnd)
		indicator.classList.remove('is-pulling')
		pulling = false
	}

	async function refresh(target: HTMLElement): Promise<void> {
		refreshing = true
		indicator.classList.add('is-refreshing')
		await options.onRefresh(target).catch(() => {
			// The column shows the error itself.
		})
		indicator.classList.remove('is-refreshing')
		refreshing = false
		place(0)
	}

	function onMove(event: TouchEvent): void {
		const touch = event.touches[0]
		if (!touch) return
		const dx = touch.clientX - startX
		const dy = touch.clientY - startY
		if (!pulling) {
			// Any other movement is a normal scroll or a swipe. Stop listening.
			if (dy < 0 || Math.abs(dx) > Math.abs(dy)) {
				release()
				return
			}
			if (dy < SLOP_PX) return
			pulling = true
			indicator.classList.add('is-pulling')
		}
		// Stops the browser's own overscroll and its page reload gesture.
		if (event.cancelable) event.preventDefault()
		place(pullDistance(dy))
	}

	function onEnd(): void {
		const commit = pulling && pullCommits(distance) && column
		release()
		if (commit) void refresh(commit)
		else place(0)
	}

	options.root.addEventListener(
		'touchstart',
		(event) => {
			const touch = event.touches[0]
			if (!touch || event.touches.length > 1 || refreshing || scrollY > 0) return
			column = (event.target as Element).closest<HTMLElement>('.column')
			if (!column) return
			startX = touch.clientX
			startY = touch.clientY
			options.root.addEventListener('touchmove', onMove, { passive: false })
			options.root.addEventListener('touchend', onEnd)
			options.root.addEventListener('touchcancel', onEnd)
		},
		{ passive: true }
	)
}
