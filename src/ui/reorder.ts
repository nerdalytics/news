interface ReorderOptions {
	/** The element that scrolls when the list is taller than the screen. */
	scroller: HTMLElement
	/** Called when a drag or a key press moved a row by one position. */
	onMove: (row: HTMLElement) => void
	/** Called when the interaction ended and the order changed. */
	onChange: () => void
}

const EDGE_PX = 56
const SCROLL_STEP_PX = 10

function rowOf(target: EventTarget | null): HTMLElement | null {
	const handle = (target as Element | null)?.closest('.handle')
	return handle?.closest<HTMLElement>('li') ?? null
}

/** Runs a reorder mutation and glides the pushed rows from their old slot to the
   new one (FLIP). The dragged row is excluded; it follows the pointer itself. The
   glide lasts one --micro beat, so reduced motion (0s) skips it entirely. */
function glidePush(list: HTMLElement, dragged: HTMLElement, mutate: () => void): void {
	const children = Array.from(list.children) as HTMLElement[]
	for (const child of children) {
		if (child !== dragged) for (const animation of child.getAnimations()) animation.cancel()
	}
	const before = new Map(children.map((child) => [child, child.getBoundingClientRect()]))
	mutate()
	const ms = Number.parseFloat(getComputedStyle(list).getPropertyValue('--micro')) * 1000
	if (!(ms > 0)) return
	for (const child of children) {
		if (child === dragged) continue
		const old = before.get(child)
		if (!old) continue
		const now = child.getBoundingClientRect()
		const dx = old.left - now.left
		const dy = old.top - now.top
		if (dx === 0 && dy === 0) continue
		child.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], {
			duration: ms,
			easing: 'ease',
		})
	}
}

/**
 * Adds drag-to-reorder to a list whose rows contain a `.handle` button.
 *
 * Pointer events cover mouse, touch and pen. A transform moves the dragged row
 * with the pointer in both axes, because the list may flow into several columns.
 * When the pointer sits over a neighbour, the code moves the row to that
 * neighbour's place in reading order. The dragged row never leaves the document,
 * so it keeps its pointer capture.
 */
export function enableReorder(list: HTMLElement, options: ReorderOptions): void {
	let row: HTMLElement | null = null
	let pointerX = 0
	let pointerY = 0
	/** The pointer position at which the row sits in its current slot without a transform. */
	let originX = 0
	let originY = 0
	let moved = false
	let frame = 0

	const positionY = (): number => pointerY + options.scroller.scrollTop

	/** The row under the pointer, ignoring the dragged row itself. */
	function rowUnderPointer(): HTMLElement | null {
		for (const child of list.children) {
			if (child === row) continue
			const bounds = child.getBoundingClientRect()
			if (
				pointerX >= bounds.left &&
				pointerX <= bounds.right &&
				pointerY >= bounds.top &&
				pointerY <= bounds.bottom
			) {
				return child as HTMLElement
			}
		}
		return null
	}

	function swapWhileOver(): void {
		const current = row
		if (!current) return
		// Each swap moves a neighbour away from the pointer; the bound guards against a cycle.
		for (let guard = list.children.length; guard > 0; guard -= 1) {
			const hit = rowUnderPointer()
			if (!hit) break
			const bounds = hit.getBoundingClientRect()
			const rect = current.getBoundingClientRect()
			const baseTop: number = rect.top - (positionY() - originY)
			// In the same grid row the horizontal position decides; otherwise the row's
			// top half comes before it and the bottom half after it, in reading order.
			const before: boolean =
				Math.abs(baseTop - bounds.top) < 1
					? pointerX < bounds.left + bounds.width / 2
					: pointerY < bounds.top + bounds.height / 2
			// The row takes the neighbour's slot (or the one after it), and the
			// neighbour flows into the space the row leaves behind.
			const children = Array.from(list.children)
			const from = children.indexOf(current)
			const hitIndex = children.indexOf(hit)
			const ref: Element | null = before && from > hitIndex ? hit : hit.nextElementSibling
			if (ref === current) break
			glidePush(list, current, () => list.insertBefore(current, ref))
			moved = true
			options.onMove(current)
			// The slot moved by the difference of the two rects (the transform is the
			// same in both). Shift the origin with it, so the row keeps following the pointer.
			const placed = current.getBoundingClientRect()
			originX += placed.left - rect.left
			originY += placed.top - rect.top
		}
	}

	function update(): void {
		if (!row) return
		swapWhileOver()
		row.style.transform = `translate(${pointerX - originX}px, ${positionY() - originY}px)`
	}

	/** Scrolls the sheet while the pointer is near its top or bottom edge. */
	function autoScroll(): void {
		if (!row) return
		const bounds = options.scroller.getBoundingClientRect()
		if (pointerY < bounds.top + EDGE_PX) options.scroller.scrollTop -= SCROLL_STEP_PX
		else if (pointerY > bounds.bottom - EDGE_PX) options.scroller.scrollTop += SCROLL_STEP_PX
		update()
		frame = requestAnimationFrame(autoScroll)
	}

	function finish(): void {
		if (!row) return
		cancelAnimationFrame(frame)
		row.style.transform = ''
		row.classList.remove('is-dragging')
		list.classList.remove('is-sorting')
		row = null
		if (moved) options.onChange()
	}

	list.addEventListener('pointerdown', (event) => {
		const target = rowOf(event.target)
		if (!target || event.button !== 0) return
		event.preventDefault()
		row = target
		moved = false
		pointerX = event.clientX
		pointerY = event.clientY
		originX = pointerX
		originY = positionY()
		row.classList.add('is-dragging')
		list.classList.add('is-sorting')
		frame = requestAnimationFrame(autoScroll)
		row.querySelector<HTMLElement>('.handle')?.setPointerCapture(event.pointerId)
	})

	list.addEventListener('pointermove', (event) => {
		if (!row) return
		pointerX = event.clientX
		pointerY = event.clientY
		update()
	})

	list.addEventListener('pointerup', finish)
	list.addEventListener('pointercancel', finish)

	list.addEventListener('keydown', (event) => {
		const target = rowOf(event.target)
		if (!target) return
		const sibling =
			event.key === 'ArrowUp'
				? target.previousElementSibling
				: event.key === 'ArrowDown'
					? target.nextElementSibling
					: null
		if (!sibling) return
		event.preventDefault()
		if (event.key === 'ArrowUp') glidePush(list, target, () => sibling.before(target))
		else glidePush(list, target, () => sibling.after(target))
		// Moving a node removes focus from it, so focus the handle again.
		target.querySelector<HTMLElement>('.handle')?.focus()
		options.onMove(target)
		options.onChange()
	})
}
