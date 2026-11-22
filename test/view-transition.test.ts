import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { slideView } from '../src/ui/dom'

type TransitionDocument = {
	startViewTransition?: (options: { update: () => void; types?: string[] }) => unknown
}

function stubStart(start: (options: { update: () => void; types?: string[] }) => unknown): void {
	;(document as unknown as TransitionDocument).startViewTransition = start
}

beforeEach(() => {
	vi.stubGlobal(
		'matchMedia',
		vi.fn(() => ({ matches: false }))
	)
})

afterEach(() => {
	Reflect.deleteProperty(document, 'startViewTransition')
	vi.unstubAllGlobals()
})

describe('slideView', () => {
	it('runs the update at once where view transitions are unsupported', () => {
		const update = vi.fn()
		slideView(update, 'forward')
		expect(update).toHaveBeenCalledTimes(1)
	})

	it('passes the update and direction to a supported browser', () => {
		const start = vi.fn()
		stubStart(start)
		const update = vi.fn()
		slideView(update, 'backward')
		expect(start).toHaveBeenCalledTimes(1)
		expect(update).not.toHaveBeenCalled()
		const options = start.mock.calls[0]![0] as { update: () => void; types?: string[] }
		expect(options.types).toEqual(['backward'])
		options.update()
		expect(update).toHaveBeenCalledTimes(1)
	})

	it('runs the update at once under reduced motion', () => {
		vi.stubGlobal(
			'matchMedia',
			vi.fn(() => ({ matches: true }))
		)
		const start = vi.fn()
		stubStart(start)
		const update = vi.fn()
		slideView(update, 'forward')
		expect(update).toHaveBeenCalledTimes(1)
		expect(start).not.toHaveBeenCalled()
	})

	it('runs the update once if the browser rejects the options form', () => {
		stubStart(() => {
			throw new Error('unsupported options')
		})
		const update = vi.fn()
		slideView(update, 'forward')
		expect(update).toHaveBeenCalledTimes(1)
	})
})
