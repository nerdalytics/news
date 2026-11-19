import { describe, expect, it } from 'vitest'
import { parseFeed } from '../scripts/hosted/lib.mjs'

// The fixtures use the field names of the live feeds, checked on 2026-11-19.
// Their content is invented.

describe('hosted feed parser', () => {
	const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
	<title>Example</title>
	<item>
		<title>First &amp; foremost</title>
		<link>https://example.com/first</link>
		<guid isPermaLink="false">abc</guid>
		<pubDate>Thu, 19 Nov 2026 10:00:00 +0000</pubDate>
		<description><![CDATA[<p>An <b>excerpt</b></p>]]></description>
	</item>
	<item><title>No link, so it is skipped</title></item>
</channel></rss>`

	const atom = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
	<title>Example</title>
	<entry>
		<title type="text">An Atom entry</title>
		<link rel="self" href="https://example.com/self"/>
		<link rel="alternate" href="https://example.com/atom"/>
		<id>tag:example.com,2026:1</id>
		<updated>2026-11-19T11:00:00Z</updated>
		<summary type="html">&lt;p&gt;Atom summary&lt;/p&gt;</summary>
	</entry>
</feed>`

	it('reads RSS items, decodes entities and strips the HTML excerpt', () => {
		expect(parseFeed(rss)).toEqual([
			{
				description: 'An excerpt',
				id: 'abc',
				time: Date.parse('2026-11-19T10:00:00Z'),
				title: 'First & foremost',
				url: 'https://example.com/first',
			},
		])
	})

	it('reads Atom entries, prefers the alternate link and decodes the summary', () => {
		expect(parseFeed(atom)).toEqual([
			{
				description: 'Atom summary',
				id: 'tag:example.com,2026:1',
				time: Date.parse('2026-11-19T11:00:00Z'),
				title: 'An Atom entry',
				url: 'https://example.com/atom',
			},
		])
	})

	it('returns nothing for a feed without entries', () => {
		expect(parseFeed('<rss><channel><title>Empty</title></channel></rss>')).toEqual([])
	})
})
