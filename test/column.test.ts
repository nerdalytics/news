import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sourceById } from '../src/sources/index'
import type { FeedItem } from '../src/sources/types'
import { siteOf } from '../src/ui/column'

const item = (url: string): FeedItem => ({ id: '1', title: 'A title', url })

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
	beforeEach(() => {
		localStorage.clear()
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

	function unseenUrls(column: { el: HTMLElement }): Array<string | undefined> {
		return [...column.el.querySelectorAll<HTMLElement>('.item.is-unseen')].map(
			(row) => row.dataset.url
		)
	}

	it('highlights every item on the first visit and none on the return', async () => {
		const column = await columnWith([item('https://example.com/a'), item('https://example.com/b')])
		column.setVisible(true)
		expect(unseenUrls(column)).toEqual(['https://example.com/a', 'https://example.com/b'])
		column.setVisible(false)
		column.setVisible(true)
		expect(unseenUrls(column)).toEqual([])
	})

	it('does not highlight items a previous page load already showed', async () => {
		const first = await columnWith([item('https://example.com/a')])
		first.setVisible(true)
		const second = await columnWith([item('https://example.com/a'), item('https://example.com/b')])
		second.setVisible(true)
		expect(unseenUrls(second)).toEqual(['https://example.com/b'])
	})

	it('does not mark items seen while the column is hidden', async () => {
		const column = await columnWith([item('https://example.com/a')])
		expect(unseenUrls(column)).toEqual([])
		column.setVisible(true)
		expect(unseenUrls(column)).toEqual(['https://example.com/a'])
	})

	it('keeps the visit highlights and adds arrivals when the feed refreshes', async () => {
		vi.resetModules()
		let current = {
			fetchedAt: Date.now(),
			items: [item('https://example.com/a'), item('https://example.com/b')],
		}
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
		expect(unseenUrls(column)).toEqual(['https://example.com/a', 'https://example.com/b'])
		current = {
			fetchedAt: Date.now(),
			items: [item('https://example.com/b'), item('https://example.com/c')],
		}
		await column.activate()
		expect(unseenUrls(column)).toEqual(['https://example.com/b', 'https://example.com/c'])
		column.setVisible(false)
		column.setVisible(true)
		expect(unseenUrls(column)).toEqual([])
	})
})
