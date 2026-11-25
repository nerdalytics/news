import { afterEach, describe, expect, it, vi } from 'vitest'

const PROBES = [
	['awwwards', 'http://feeds.feedburner.com/awwwards-sites-of-the-day'],
	['booooooom', 'https://www.booooooom.com/feed/'],
	['colossal', 'https://www.thisiscolossal.com/feed/'],
	['creativeboom', 'https://www.creativeboom.com/feed/'],
	['csstricks', 'http://feeds.feedburner.com/CssTricks'],
	['landbook', 'https://land-book.com/feed/'],
	['sidebar', 'https://sidebar.io/feed.xml'],
	['siteinspire', 'https://www.siteinspire.com/websites/feed'],
	['techcrunch', 'https://techcrunch.com/feed/'],
	['wired', 'https://www.wired.com/feed/rss'],
	['thehackernews', 'https://feeds.feedburner.com/TheHackersNews'],
	['bleepingcomputer', 'https://www.bleepingcomputer.com/feed/'],
	['krebs', 'https://krebsonsecurity.com/feed/'],
	['securityweek', 'https://www.securityweek.com/feed/'],
	['darkreading', 'https://www.darkreading.com/rss.xml'],
	['theregister', 'https://www.theregister.com/security/headlines.atom'],
	['schneier', 'https://www.schneier.com/feed/atom'],
	['troyhunt', 'https://www.troyhunt.com/rss/'],
	['grahamcluley', 'https://www.grahamcluley.com/feed/'],
	['sans', 'https://isc.sans.edu/rssfeed_full.xml'],
	['portswigger', 'https://portswigger.net/research/rss'],
] as const

const FEED_ACCEPT = 'application/rss+xml, application/atom+xml, application/xml;q=0.9'

const RSS =
	'<?xml version="1.0"?><rss><channel><item><title>One</title><link>https://example.com/1</link></item></channel></rss>'

afterEach(() => {
	vi.unstubAllGlobals()
})

describe('hosted feed probes', () => {
	it.each(PROBES)(
		'%s fetches its endpoint as a feed and parses the items',
		async (id, endpoint) => {
			const fetchMock = vi.fn(
				async (_url: string, _init: { headers?: Record<string, string> }) => ({
					ok: true,
					text: async () => RSS,
				})
			)
			vi.stubGlobal('fetch', fetchMock)
			const { default: fetchItems } = await import(`../scripts/hosted/sources/${id}.mjs`)
			const items = await fetchItems()
			expect(fetchMock).toHaveBeenCalledTimes(1)
			const call = fetchMock.mock.calls[0]
			expect(call?.[0]).toBe(endpoint)
			expect(call?.[1]?.headers).toMatchObject({ Accept: FEED_ACCEPT })
			expect(items).toEqual([
				{ id: 'https://example.com/1', title: 'One', url: 'https://example.com/1' },
			])
		}
	)
})
