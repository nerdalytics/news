interface ReorderOptions {
	/** The element that scrolls when the list is taller than the screen. */
	scroller: HTMLElement
	/** A row moved by one position (drag or keyboard). */
	onMove: (row: HTMLElement) => void
	/** The order changed and the interaction is finished. */
	onChange: () => void
}

const EDGE_PX = 56
const SCROLL_STEP_PX = 10

function rowOf(target: EventTarget | null): HTMLElement | null {
	const handle = (target as Element | null)?.closest('.handle')
	return handle?.closest<HTMLElement>('li') ?? null
}

/**
 * Drag-to-reorder for a list whose rows carry a `.handle` button.
 *
 * Pointer events cover mouse, touch and pen alike. The dragged row follows the
 * pointer through a transform; whenever it passes the middle of a neighbour the
 * neighbour is moved to its other side, so the dragged row itself never leaves
 * the document and keeps its pointer capture.
 */
export function enableReorder(list: HTMLElement, options: ReorderOptions): void {
	let row: HTMLElement | null = null
	let pointerY = 0
	/** Where the pointer would be if the row sat untransformed in its current slot. */
	let originY = 0
	let moved = false
	let frame = 0

	const position = (): number => pointerY + options.scroller.scrollTop

	function swapWhilePast(): void {
		if (!row) return
		for (;;) {
			const offset = position() - originY
			const next = row.nextElementSibling as HTMLElement | null
			const previous = row.previousElementSibling as HTMLElement | null
			if (next && offset > next.offsetHeight / 2) {
				originY += next.offsetHeight
				row.before(next)
			} else if (previous && offset < -previous.offsetHeight / 2) {
				originY -= previous.offsetHeight
				row.after(previous)
			} else {
				break
			}
			moved = true
			options.onMove(row)
		}
	}

	function update(): void {
		if (!row) return
		swapWhilePast()
		row.style.transform = `translateY(${position() - originY}px)`
	}

	/** Scrolls the sheet while the pointer rests near its top or bottom edge. */
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
		pointerY = event.clientY
		originY = position()
		row.classList.add('is-dragging')
		list.classList.add('is-sorting')
		row.querySelector<HTMLElement>('.handle')?.setPointerCapture(event.pointerId)
		frame = requestAnimationFrame(autoScroll)
	})

	list.addEventListener('pointermove', (event) => {
		if (!row) return
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
		if (event.key === 'ArrowUp') sibling.before(target)
		else sibling.after(target)
		// Moving a node drops focus; put it back on the handle.
		target.querySelector<HTMLElement>('.handle')?.focus()
		options.onMove(target)
		options.onChange()
	})
}
