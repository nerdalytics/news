import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableReorder } from '../src/ui/reorder'

const ROW_HEIGHT = 100

function pointer(type: string, target: Element, x: number, y: number): void {
	const Ctor = typeof PointerEvent === 'undefined' ? MouseEvent : PointerEvent
	target.dispatchEvent(new Ctor(type, { bubbles: true, button: 0, clientX: x, clientY: y }))
}

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 40))

function setup() {
	const scroller = document.createElement('div')
	const list = document.createElement('ul')
	scroller.append(list)
	document.body.append(scroller)
	const rows = ['a', 'b', 'c'].map((id) => {
		const row = document.createElement('li')
		row.dataset.id = id
		const handle = document.createElement('button')
		handle.className = 'handle'
		handle.setPointerCapture = () => {}
		row.append(handle)
		list.append(row)
		return row
	})
	const visual = new Map<HTMLElement, number>()
	const glides = new Map<HTMLElement, number>()
	const layoutTop = (row: HTMLElement): number =>
		Array.from(list.children).indexOf(row) * ROW_HEIGHT
	for (const row of rows) {
		row.getBoundingClientRect = () =>
			new DOMRect(0, visual.get(row) ?? layoutTop(row), 300, ROW_HEIGHT)
		row.getAnimations = () => []
		row.animate = ((frames: Keyframe[]) => {
			const dy = Number(/, ([-\d.]+)px\)/.exec(String(frames[0]?.transform))?.[1] ?? 0)
			visual.set(row, layoutTop(row) + dy)
			glides.set(row, (glides.get(row) ?? 0) + 1)
			return { cancel: () => visual.delete(row) }
		}) as unknown as typeof row.animate
	}
	scroller.getBoundingClientRect = () => new DOMRect(0, 0, 300, 1000)
	const onChange = vi.fn()
	enableReorder(list, { scroller, onChange, onMove: vi.fn() })
	return {
		rows,
		glides,
		onChange,
		ids: (): string[] =>
			Array.from(list.children).map((row) => (row as HTMLElement).dataset.id ?? ''),
		down: (row: HTMLElement, x: number, y: number): void =>
			pointer('pointerdown', row.querySelector('.handle') as Element, x, y),
		move: (x: number, y: number): void => pointer('pointermove', list, x, y),
		up: (): void => pointer('pointerup', list, 0, 0),
	}
}

describe('reorder', () => {
	beforeEach(() => {
		vi.stubGlobal('getComputedStyle', () => ({ getPropertyValue: () => '0.3s' }))
	})

	afterEach(() => {
		vi.unstubAllGlobals()
		document.body.replaceChildren()
	})

	it('keeps the drop slot while the pushed row glides', async () => {
		const { rows, down, move, up, ids, glides, onChange } = setup()
		down(rows[1]!, 10, 150)
		move(10, 250)
		await tick()
		await tick()
		expect(ids()).toEqual(['a', 'c', 'b'])
		expect(glides.get(rows[2]!)).toBe(1)
		up()
		expect(ids()).toEqual(['a', 'c', 'b'])
		expect(rows[1]!.style.transform).toBe('')
		expect(onChange).toHaveBeenCalledTimes(1)
	})

	it('moves a row with the arrow keys and glides the pushed row', () => {
		const { rows, ids, glides, onChange } = setup()
		const handle = rows[0]!.querySelector('.handle') as Element
		handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
		expect(ids()).toEqual(['b', 'a', 'c'])
		expect(glides.get(rows[1]!)).toBe(1)
		expect(onChange).toHaveBeenCalledTimes(1)
	})
})
