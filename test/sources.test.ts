import { describe, expect, it } from 'vitest'
import * as devto from '../src/sources/devto'
import * as github from '../src/sources/github'
import * as hackernews from '../src/sources/hackernews'
import * as huggingface from '../src/sources/huggingface'
import * as lemmy from '../src/sources/lemmy'
import * as mastodon from '../src/sources/mastodon'
import * as stackoverflow from '../src/sources/stackoverflow'
import * as thenextweb from '../src/sources/thenextweb'
import { LIMIT } from '../src/sources/types'
import * as wikipedia from '../src/sources/wikipedia'

// The fixtures mirror the field names of the live responses (checked 2026-11-15)
// with made-up content.

describe('Hacker News', () => {
	const hits = [
		{
			created_at_i: 1_794_691_344,
			num_comments: 45,
			objectID: '102',
			points: 70,
			title: 'Second on the front page',
			url: 'https://example.com/second',
		},
		{ num_comments: 3, objectID: '101', points: 12, title: 'Ask HN: First?', url: null },
		{ objectID: '104', points: 1, title: 'Unsafe link', url: 'javascript:alert(1)' },
	]

	it('restores front page order and skips ids the index does not know', () => {
		const items = hackernews.parse([101, 102, 103, 104], { hits })
		expect(items.map((item) => item.id)).toEqual(['101', '102', '104'])
	})

	it('maps points, comments, time and the discussion link', () => {
		const [, second] = hackernews.parse([101, 102], { hits })
		expect(second).toEqual({
			comments: {
				count: 45,
				label: 'comment',
				url: 'https://news.ycombinator.com/item?id=102',
			},
			id: '102',
			score: { label: 'point', value: 70 },
			time: 1_794_691_344_000,
			title: 'Second on the front page',
			url: 'https://example.com/second',
		})
	})

	it('links text posts and unsafe URLs to the discussion', () => {
		const items = hackernews.parse([101, 104], { hits })
		expect(items[0]?.url).toBe('https://news.ycombinator.com/item?id=101')
		expect(items[1]?.url).toBe('https://news.ycombinator.com/item?id=104')
	})

	it('never returns more than the limit', () => {
		const ids = Array.from({ length: 30 }, (_, index) => index + 1)
		const many = ids.map((id) => ({ objectID: String(id), title: `Story ${id}` }))
		expect(hackernews.parse(ids, { hits: many })).toHaveLength(LIMIT)
	})

	it('asks for all stories in one batched search', () => {
		const url = new URL(hackernews.searchUrl([7, 8]))
		expect(url.origin + url.pathname).toBe('https://hn.algolia.com/api/v1/search')
		expect(url.searchParams.get('tags')).toBe('(story,poll),(story_7,story_8)')
		expect(url.searchParams.get('hitsPerPage')).toBe('2')
	})
})

describe('GitHub', () => {
	it('searches repositories created in the last week, most starred first', () => {
		const url = new URL(github.searchUrl(new Date('2026-11-15T10:00:00Z')))
		expect(url.searchParams.get('q')).toBe('created:>2026-11-08')
		expect(url.searchParams.get('sort')).toBe('stars')
		expect(url.searchParams.get('per_page')).toBe(String(LIMIT))
	})

	it('maps repositories; they have no comments', () => {
		const items = github.parse({
			items: [
				{
					created_at: '2026-11-10T00:00:00Z',
					description: 'A thing',
					full_name: 'octo/thing',
					html_url: 'https://github.com/octo/thing',
					id: 1,
					language: 'Rust',
					stargazers_count: 1234,
				},
				{
					description: null,
					full_name: 'octo/bare',
					html_url: 'https://github.com/octo/bare',
					id: 2,
					language: null,
					stargazers_count: 5,
				},
			],
		})
		expect(items[0]).toEqual({
			description: 'A thing',
			id: '1',
			score: { label: 'star', value: 1234 },
			tag: 'Rust',
			time: Date.parse('2026-11-10T00:00:00Z'),
			title: 'octo/thing',
			url: 'https://github.com/octo/thing',
		})
		expect(items[1]).toEqual({
			id: '2',
			score: { label: 'star', value: 5 },
			title: 'octo/bare',
			url: 'https://github.com/octo/bare',
		})
	})
})

describe('DEV', () => {
	it('maps articles and links comments to the comment section', () => {
		const [item] = devto.parse([
			{
				comments_count: 6,
				description: 'Short summary',
				id: 9,
				public_reactions_count: 33,
				published_at: '2026-11-15T04:00:28Z',
				title: 'A post',
				url: 'https://dev.to/someone/a-post-1abc',
			},
		])
		expect(item?.comments).toEqual({
			count: 6,
			label: 'comment',
			url: 'https://dev.to/someone/a-post-1abc#comments',
		})
		expect(item?.score).toEqual({ label: 'reaction', value: 33 })
		expect(item?.description).toBe('Short summary')
	})
})

describe('Lemmy', () => {
	const post = (id: number, extra: Record<string, unknown> = {}) => ({
		counts: { comments: id, score: id * 10 },
		post: {
			id,
			name: `Post ${id}`,
			published: '2026-11-15T21:06:01.120744Z',
			url: `https://example.com/${id}`,
			...extra,
		},
	})

	it('filters pinned, removed, deleted and NSFW posts', () => {
		const items = lemmy.parse({
			posts: [
				post(1, { featured_community: true }),
				post(2, { nsfw: true }),
				post(3, { removed: true }),
				post(4, { deleted: true }),
				post(5),
			],
		})
		expect(items.map((item) => item.id)).toEqual(['5'])
	})

	it('keeps only the first of several cross-posts of one link', () => {
		const items = lemmy.parse({
			posts: [post(1), post(2, { url: 'https://example.com/1' }), post(3)],
		})
		expect(items.map((item) => item.id)).toEqual(['1', '3'])
	})

	it('links comments to the post on the instance, also for posts without a link', () => {
		const [item] = lemmy.parse({ posts: [post(7, { url: null })] })
		expect(item?.url).toBe('https://lemmy.world/post/7')
		expect(item?.comments?.url).toBe('https://lemmy.world/post/7')
		expect(item?.comments?.count).toBe(7)
	})
})

describe('Stack Overflow', () => {
	it('decodes titles and exposes answers as the discussion', () => {
		const [item] = stackoverflow.parse({
			items: [
				{
					answer_count: 1,
					creation_date: 1_794_776_038,
					link: 'https://stackoverflow.com/questions/1/why',
					question_id: 1,
					score: 23,
					tags: ['python', 'list'],
					title: 'Why does &quot;+=&quot; differ from `a = a + b`?',
				},
			],
		})
		expect(item?.title).toBe('Why does "+=" differ from `a = a + b`?')
		expect(item?.comments).toEqual({
			count: 1,
			label: 'answer',
			url: 'https://stackoverflow.com/questions/1/why#answers',
		})
		expect(item?.tag).toBe('python')
		expect(item?.time).toBe(1_794_776_038_000)
	})
})

describe('Mastodon', () => {
	it('sums the uses of the two most recent days', () => {
		const [item] = mastodon.parse([
			{
				description: 'Summary',
				history: [
					{ accounts: '119', day: '1794700800', uses: '122' },
					{ accounts: '698', day: '1794614400', uses: '820' },
					{ accounts: '1', day: '1794528000', uses: '1' },
				],
				provider_name: 'Example News',
				published_at: null,
				title: 'A trending link',
				url: 'https://example.com/story',
			},
		])
		expect(item?.score).toEqual({ label: 'share', value: 942 })
		expect(item?.tag).toBe('Example News')
		expect(item?.time).toBeUndefined()
	})

	it('skips entries without a usable URL', () => {
		expect(mastodon.parse([{ title: 'x', url: 'ftp://example.com' }])).toEqual([])
	})
})

describe('Hugging Face', () => {
	it('builds the model URL from the id', () => {
		const [item] = huggingface.parse([
			{ createdAt: '2026-11-01T00:00:00.000Z', id: 'org/model-1', likes: 7, pipeline_tag: 'asr' },
		])
		expect(item?.url).toBe('https://huggingface.co/org/model-1')
		expect(item?.score).toEqual({ label: 'like', value: 7 })
		expect(item?.tag).toBe('asr')
	})
})

describe('Wikipedia', () => {
	it('maps the most read articles', () => {
		const [item] = wikipedia.parse({
			mostread: {
				articles: [
					{
						content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Example' } },
						description: 'An example',
						pageid: 5,
						titles: { normalized: 'Example' },
						views: 727_529,
					},
				],
			},
		})
		expect(item).toEqual({
			description: 'An example',
			id: '5',
			score: { label: 'view', value: 727_529 },
			title: 'Example',
			url: 'https://en.wikipedia.org/wiki/Example',
		})
	})

	it('returns nothing for a day without a list', () => {
		expect(wikipedia.parse({})).toEqual([])
	})
})

describe('The Next Web', () => {
	const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/">
<channel>
	<title>The Next Web</title>
	<link>https://thenextweb.com</link>
	<item>
		<title>First &amp; foremost</title>
		<link>https://thenextweb.com/news/first</link>
		<pubDate>Sun, 15 Nov 2026 20:22:54 +0000</pubDate>
		<dc:creator><![CDATA[A Writer]]></dc:creator>
		<category><![CDATA[Business]]></category>
		<category><![CDATA[Chips]]></category>
		<guid isPermaLink="false">TheNextWeb=abc</guid>
		<description><![CDATA[<p>Ignored <b>markup</b></p>]]></description>
	</item>
	<item>
		<title>No link, so it is skipped</title>
	</item>
</channel>
</rss>`

	it('reads title, link, date and first category of each entry', () => {
		expect(thenextweb.parse(feed)).toEqual([
			{
				id: 'TheNextWeb=abc',
				tag: 'Business',
				time: Date.parse('2026-11-15T20:22:54Z'),
				title: 'First & foremost',
				url: 'https://thenextweb.com/news/first',
			},
		])
	})
})
