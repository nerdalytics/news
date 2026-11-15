import type { SourceAdapter, SourceMeta } from './types'

/**
 * The catalogue. Only sources listed here can be enabled; each one talks to a
 * public, CORS-enabled endpoint, so the app needs no backend.
 */
export const SOURCES: readonly SourceMeta[] = [
	{
		id: 'hn',
		name: 'Hacker News',
		tagline: 'Top stories',
		mark: 'Y',
		badge: ['#f0652f', '#ffffff'],
		accent: ['#e8590c', '#ff7a45'],
		home: 'https://news.ycombinator.com/',
		comments: true,
		enabledByDefault: true,
		ttl: 5,
	},
	{
		id: 'github',
		name: 'GitHub',
		tagline: 'Most starred new repos this week',
		mark: 'GH',
		badge: ['#24292f', '#ffffff'],
		accent: ['#1f2328', '#e6edf3'],
		home: 'https://github.com/trending',
		comments: false,
		enabledByDefault: true,
		ttl: 30,
	},
	{
		id: 'devto',
		name: 'DEV',
		tagline: 'Top posts today',
		mark: 'DEV',
		badge: ['#0a0a0a', '#ffffff'],
		accent: ['#3b49df', '#8f9bff'],
		home: 'https://dev.to/',
		comments: true,
		enabledByDefault: true,
		ttl: 15,
	},
	{
		id: 'lemmy',
		name: 'Lemmy',
		tagline: 'Technology on lemmy.world',
		mark: 'L',
		badge: ['#0e9f6e', '#ffffff'],
		accent: ['#0b8a5f', '#34d399'],
		home: 'https://lemmy.world/c/technology',
		comments: true,
		enabledByDefault: true,
		ttl: 10,
	},
	{
		id: 'tnw',
		name: 'The Next Web',
		tagline: 'Latest stories',
		mark: 'TNW',
		badge: ['#e6392f', '#ffffff'],
		accent: ['#d42e25', '#ff5a4f'],
		home: 'https://thenextweb.com/',
		comments: false,
		enabledByDefault: true,
		ttl: 15,
	},
	{
		id: 'mastodon',
		name: 'Mastodon',
		tagline: 'Trending links on mastodon.social',
		mark: 'M',
		badge: ['#6364ff', '#ffffff'],
		accent: ['#5253e6', '#8c8dff'],
		home: 'https://mastodon.social/explore/links',
		comments: false,
		enabledByDefault: true,
		ttl: 10,
	},
	{
		id: 'stackoverflow',
		name: 'Stack Overflow',
		tagline: 'Hot questions this week',
		mark: 'SO',
		badge: ['#f48024', '#ffffff'],
		accent: ['#c2600a', '#f59e42'],
		home: 'https://stackoverflow.com/?tab=week',
		comments: true,
		enabledByDefault: false,
		ttl: 30,
	},
	{
		id: 'huggingface',
		name: 'Hugging Face',
		tagline: 'Trending models',
		mark: 'HF',
		badge: ['#ffd21e', '#1f2328'],
		accent: ['#a16207', '#ffd21e'],
		home: 'https://huggingface.co/models?sort=trending',
		comments: false,
		enabledByDefault: false,
		ttl: 30,
	},
	{
		id: 'wikipedia',
		name: 'Wikipedia',
		tagline: 'Most read articles yesterday',
		mark: 'W',
		badge: ['#54595d', '#ffffff'],
		accent: ['#54595d', '#c8ccd1'],
		home: 'https://en.wikipedia.org/wiki/Wikipedia:Top_25_Report',
		comments: false,
		enabledByDefault: false,
		ttl: 60,
	},
]

const BY_ID = new Map(SOURCES.map((source) => [source.id, source]))

export function sourceById(id: string): SourceMeta | undefined {
	return BY_ID.get(id)
}

type AdapterModule = { default: SourceAdapter }

/** Each adapter is its own chunk and is only downloaded when its source is used. */
const LOADERS: Record<string, () => Promise<AdapterModule>> = {
	devto: () => import('./devto'),
	github: () => import('./github'),
	hn: () => import('./hackernews'),
	huggingface: () => import('./huggingface'),
	lemmy: () => import('./lemmy'),
	mastodon: () => import('./mastodon'),
	stackoverflow: () => import('./stackoverflow'),
	tnw: () => import('./thenextweb'),
	wikipedia: () => import('./wikipedia'),
}

export async function loadAdapter(id: string): Promise<SourceAdapter> {
	const loader = LOADERS[id]
	if (!loader) throw new Error(`Unknown source: ${id}`)
	return (await loader()).default
}
