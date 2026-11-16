import { describe, expect, it } from 'vitest'
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
