import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sourceById } from '../src/sources/index'
import type { FeedItem } from '../src/sources/types'
import { siteOf } from '../src/ui/column'

const item = (url: string): FeedItem => ({ id: '1', title: 'A title', url })

interface FakeEntry {
	isIntersecting: boolean
	target: Element
}

class FakeObserver {
	static all: FakeObserver[] = []
	private targets: Element[] = []
	private readonly cb: (entries: FakeEntry[]) => void
	constructor(cb: (entries: FakeEntry[]) => void) {
		this.cb = cb
		FakeObserver.all.push(this)
	}
	observe(target: Element): void {
		this.targets.push(target)
	}
	unobserve(target: Element): void {
		this.targets = this.targets.filter((t) => t !== target)
	}
	disconnect(): void {
		this.targets = []
	}
	intersect(...urls: string[]): void {
		const entries = this.targets
			.filter((t) => urls.includes((t as HTMLElement).dataset.url ?? ''))
			.map((target) => ({ isIntersecting: true, target }))
		this.cb(entries)
	}
}

describe('siteOf', () => {
	const hn = sourceById('hn')!
	const github = sourceById('github')!

	it('returns the host a link aggregator entry points to', () => {
		expect(siteOf(item('https://www.slate.com/story'), hn)).toBe('slate.com')
		expect(siteOf(item('https://github.com/octo/thing'), hn)).toBe('github.com')
	})

	it('returns nothing when the link stays on the source', () => {
		expect(siteOf(item('https://news.ycombinator.com/item?id=1'), hn)).toBeUndefined()
		expect(siteOf(item('https://github.com/octo/thing'), github)).toBeUndefined()
	})
})

describe('Column novelty', () => {
	const A = 'https://example.com/a'
	const B = 'https://example.com/b'
	const C = 'https://example.com/c'

	beforeEach(() => {
		localStorage.clear()
		FakeObserver.all = []
		globalThis.IntersectionObserver = FakeObserver as unknown as typeof IntersectionObserver
	})

	afterEach(() => {
		vi.doUnmock('../src/cache')
		vi.resetModules()
	})

	async function columnWith(items: FeedItem[]) {
		vi.resetModules()
		localStorage.setItem('thenews:feed:v1:hn', JSON.stringify({ fetchedAt: Date.now(), items }))
		const { Column } = await import('../src/ui/column')
		const { sourceById: byId } = await import('../src/sources/index')
		return new Column(
			byId('hn')!,
			() => {},
			() => {}
		)
	}

	function observer(): FakeObserver {
		return FakeObserver.all.at(-1)!
	}

	function urls(column: { el: HTMLElement }, selector: string): Array<string | undefined> {
		return [...column.el.querySelectorAll<HTMLElement>(selector)].map((row) => row.dataset.url)
	}

	function unseenUrls(column: { el: HTMLElement }): Array<string | undefined> {
		return urls(column, '.item.is-unseen')
	}

	function flashingUrls(column: { el: HTMLElement }): Array<string | undefined> {
		return urls(column, '.item.is-flashing')
	}

	function seenUrls(): string[] {
		return JSON.parse(localStorage.getItem('thenews:seen:v1:hn') ?? '[]')
	}

	it('marks an item seen only when it scrolls into view', async () => {
		const column = await columnWith([item(A), item(B)])
		column.setVisible(true)
		observer().intersect(A)
		expect(unseenUrls(column)).toEqual([A])
		expect(seenUrls()).toEqual([A])
		observer().intersect(B)
		expect(unseenUrls(column)).toEqual([A, B])
		expect(seenUrls()).toEqual([A, B])
	})

	it('flashes an item when it enters view, not while below the fold', async () => {
		const column = await columnWith([item(A), item(B)])
		column.setVisible(true)
		observer().intersect(A)
		expect(flashingUrls(column)).toEqual([A])
		observer().intersect(B)
		expect(flashingUrls(column)).toEqual([A, B])
	})

	it('keeps below-fold items new across a reload', async () => {
		const first = await columnWith([item(A), item(B), item(C)])
		first.setVisible(true)
		observer().intersect(A)
		const second = await columnWith([item(A), item(B), item(C)])
		second.setVisible(true)
		observer().intersect(A, B, C)
		expect(unseenUrls(second)).toEqual([B, C])
	})

	it('drops the bold for seen items on a return visit', async () => {
		const column = await columnWith([item(A), item(B)])
		column.setVisible(true)
		observer().intersect(A, B)
		expect(unseenUrls(column)).toEqual([A, B])
		column.setVisible(false)
		column.setVisible(true)
		observer().intersect(A, B)
		expect(unseenUrls(column)).toEqual([])
	})

	it('drops the highlights when the visit ends on app resume', async () => {
		const column = await columnWith([item(A), item(B)])
		column.setVisible(true)
		observer().intersect(A, B)
		expect(unseenUrls(column)).toEqual([A, B])
		column.endVisit()
		observer().intersect(A, B)
		expect(unseenUrls(column)).toEqual([])
	})

	it('marks nothing seen while the column is hidden', async () => {
		const column = await columnWith([item(A)])
		expect(unseenUrls(column)).toEqual([])
		expect(seenUrls()).toEqual([])
		column.setVisible(true)
		observer().intersect(A)
		expect(unseenUrls(column)).toEqual([A])
	})

	it('keeps the visit bold and flashes only new arrivals on refresh', async () => {
		vi.resetModules()
		let current = { fetchedAt: Date.now(), items: [item(A), item(B)] }
		vi.doMock('../src/cache', () => ({
			peek: () => current,
			isFresh: () => true,
			refresh: () => Promise.resolve(current),
		}))
		const { Column } = await import('../src/ui/column')
		const { sourceById: byId } = await import('../src/sources/index')
		const column = new Column(
			byId('hn')!,
			() => {},
			() => {}
		)
		column.setVisible(true)
		observer().intersect(A, B)
		expect(unseenUrls(column)).toEqual([A, B])
		current = { fetchedAt: Date.now(), items: [item(B), item(C)] }
		await column.activate()
		expect(flashingUrls(column)).toEqual([])
		observer().intersect(B, C)
		expect(unseenUrls(column)).toEqual([B, C])
		expect(flashingUrls(column)).toEqual([C])
		column.setVisible(false)
		column.setVisible(true)
		observer().intersect(B, C)
		expect(unseenUrls(column)).toEqual([])
	})
})
