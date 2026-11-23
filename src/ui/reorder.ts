interface ReorderOptions {
	scroller: HTMLElement
	onMove: (row: HTMLElement) => void
	onChange: () => void
	onSortEnd?: () => void
}

const EDGE_PX = 56
const SCROLL_STEP_PX = 10

function rowOf(target: EventTarget | null): HTMLElement | null {
	const handle = (target as Element | null)?.closest('.handle')
	return handle?.closest<HTMLElement>('li') ?? null
}

export function enableReorder(list: HTMLElement, options: ReorderOptions): void {
	let row: HTMLElement | null = null
	let pointerX = 0
	let pointerY = 0
	let originX = 0
	let originY = 0
	let moved = false
	let started = false
	let downY = 0
	let frame = 0
	const slots = new Map<HTMLElement, DOMRect>()
	let slotTop = 0
	let slotLeft = 0

	const positionY = (): number => pointerY + options.scroller.scrollTop

	function boundsOf(child: HTMLElement): DOMRect {
		const slot = slots.get(child)
		if (!slot) return child.getBoundingClientRect()
		return new DOMRect(
			slot.left - (options.scroller.scrollLeft - slotLeft),
			slot.top - (options.scroller.scrollTop - slotTop),
			slot.width,
			slot.height
		)
	}

	const rowsOf = (): HTMLElement[] =>
		(Array.from(list.children) as HTMLElement[]).filter((child) => child.tagName === 'LI')

	function glidePush(dragged: HTMLElement, mutate: () => void): void {
		const children = rowsOf()
		for (const child of children) {
			if (child !== dragged) for (const animation of child.getAnimations()) animation.cancel()
		}
		const before = new Map(children.map((child) => [child, child.getBoundingClientRect()]))
		mutate()
		slotTop = options.scroller.scrollTop
		slotLeft = options.scroller.scrollLeft
		for (const child of children) slots.set(child, child.getBoundingClientRect())
		const ms = Number.parseFloat(getComputedStyle(list).getPropertyValue('--micro')) * 2000
		if (!(ms > 0)) return
		for (const child of children) {
			if (child === dragged) continue
			const old = before.get(child)
			const now = slots.get(child)
			if (!old || !now) continue
			const dx = old.left - now.left
			const dy = old.top - now.top
			if (dx === 0 && dy === 0) continue
			child.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], {
				duration: ms,
				easing: 'ease',
			})
		}
	}

	function rowUnderPointer(): HTMLElement | null {
		for (const child of rowsOf()) {
			if (child === row) continue
			const bounds = boundsOf(child)
			if (
				pointerX >= bounds.left &&
				pointerX <= bounds.right &&
				pointerY >= bounds.top &&
				pointerY <= bounds.bottom
			) {
				return child
			}
		}
		return null
	}

	function swapWhileOver(): void {
		const current = row
		if (!current) return
		for (let guard = list.children.length; guard > 0; guard -= 1) {
			const hit = rowUnderPointer()
			if (!hit) break
			const rect = current.getBoundingClientRect()
			const children = rowsOf()
			const from = children.indexOf(current)
			const hitIndex = children.indexOf(hit)
			const ref: Element | null = from > hitIndex ? hit : hit.nextElementSibling
			if (ref === current) break
			glidePush(current, () => list.insertBefore(current, ref))
			moved = true
			options.onMove(current)
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
		if (started) {
			row.style.transform = ''
			row.classList.remove('is-dragging')
			list.classList.remove('is-sorting')
		}
		slots.clear()
		row = null
		if (moved) options.onChange()
		options.onSortEnd?.()
	}

	list.addEventListener('pointerdown', (event) => {
		const target = rowOf(event.target)
		if (!target || event.button !== 0) return
		event.preventDefault()
		row = target
		moved = false
		started = false
		pointerX = event.clientX
		pointerY = event.clientY
		downY = event.clientY
		originX = pointerX
		originY = positionY()
	})

	list.addEventListener('pointermove', (event) => {
		if (!row) return
		pointerX = event.clientX
		pointerY = event.clientY
		if (!started) {
			if (Math.hypot(pointerX - originX, pointerY - downY) < 1) return
			started = true
			row.classList.add('is-dragging')
			list.classList.add('is-sorting')
			frame = requestAnimationFrame(autoScroll)
			row.querySelector<HTMLElement>('.handle')?.setPointerCapture(event.pointerId)
		}
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
		if (event.key === 'ArrowUp') glidePush(target, () => sibling.before(target))
		else glidePush(target, () => sibling.after(target))
		target.querySelector<HTMLElement>('.handle')?.focus()
		options.onMove(target)
		options.onChange()
	})
}
