import { el, icon } from './dom'
import { PULL_COMMIT_PX, pullCommits, pullDistance, SLOP_PX } from './gestures'

interface PullOptions {
	root: HTMLElement
	onRefresh: (column: HTMLElement) => Promise<void>
}

export function enablePullToRefresh(options: PullOptions): void {
	const indicator = el('div', 'pull')
	indicator.setAttribute('aria-hidden', 'true')
	indicator.append(icon('refresh'))
	indicator.style.setProperty('--pull-rest', `${PULL_COMMIT_PX}px`)
	document.body.append(indicator)

	let column: HTMLElement | null = null
	let startX = 0
	let startY = 0
	let distance = 0
	let pulling = false
	let refreshing = false

	const setActive = (active: boolean): void => {
		document.documentElement.classList.toggle('is-pull-active', active)
	}

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
		await options.onRefresh(target).catch(() => {})
		indicator.classList.remove('is-refreshing')
		refreshing = false
		setActive(false)
		place(0)
	}

	function onMove(event: TouchEvent): void {
		const touch = event.touches[0]
		if (!touch) return
		const dx = touch.clientX - startX
		const dy = touch.clientY - startY
		if (!pulling) {
			if (dy < 0 || Math.abs(dx) > Math.abs(dy)) {
				release()
				return
			}
			if (dy < SLOP_PX) return
			pulling = true
			indicator.classList.add('is-pulling')
			setActive(true)
		}
		if (event.cancelable) event.preventDefault()
		place(pullDistance(dy))
	}

	function onEnd(): void {
		const commit = pulling && pullCommits(distance) && column
		release()
		if (commit) {
			void refresh(commit)
			return
		}
		setActive(false)
		place(0)
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
