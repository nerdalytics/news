import { afterEach, describe, expect, it, type Mock, vi } from 'vitest'
import { enableOutsideDismiss } from '../src/ui/dom'

function makeDialog(): { dialog: HTMLDialogElement; close: Mock } {
	const dialog = document.createElement('dialog')
	const close = vi.fn()
	dialog.close = close as unknown as HTMLDialogElement['close']
	dialog.getBoundingClientRect = () =>
		({
			left: 100,
			right: 300,
			top: 100,
			bottom: 300,
			width: 200,
			height: 200,
			x: 100,
			y: 100,
			toJSON: () => ({}),
		}) as DOMRect
	return { dialog, close }
}

function pressAndRelease(dialog: HTMLDialogElement, x: number, y: number): void {
	dialog.dispatchEvent(new PointerEvent('pointerdown', { clientX: x, clientY: y }))
	dialog.dispatchEvent(new PointerEvent('pointerup', { clientX: x, clientY: y }))
}

describe('enableOutsideDismiss', () => {
	afterEach(() => {
		Reflect.deleteProperty(HTMLDialogElement.prototype, 'closedBy')
	})

	it('closes when the press and release both land outside', () => {
		const { dialog, close } = makeDialog()
		enableOutsideDismiss(dialog)
		pressAndRelease(dialog, 50, 50)
		expect(close).toHaveBeenCalledTimes(1)
	})

	it('stays open when the press starts inside', () => {
		const { dialog, close } = makeDialog()
		enableOutsideDismiss(dialog)
		dialog.dispatchEvent(new PointerEvent('pointerdown', { clientX: 200, clientY: 200 }))
		dialog.dispatchEvent(new PointerEvent('pointerup', { clientX: 50, clientY: 50 }))
		expect(close).not.toHaveBeenCalled()
	})

	it('stays open when a drag that started outside ends inside', () => {
		const { dialog, close } = makeDialog()
		enableOutsideDismiss(dialog)
		dialog.dispatchEvent(new PointerEvent('pointerdown', { clientX: 50, clientY: 50 }))
		dialog.dispatchEvent(new PointerEvent('pointerup', { clientX: 200, clientY: 200 }))
		expect(close).not.toHaveBeenCalled()
	})

	it('does nothing where closedby is supported', () => {
		Object.defineProperty(HTMLDialogElement.prototype, 'closedBy', {
			value: 'any',
			configurable: true,
		})
		const { dialog, close } = makeDialog()
		enableOutsideDismiss(dialog)
		pressAndRelease(dialog, 50, 50)
		expect(close).not.toHaveBeenCalled()
	})
})
