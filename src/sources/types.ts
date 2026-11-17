/** A number with the singular noun it counts, e.g. `{ value: 70, label: 'point' }`. */
export interface Count {
	value: number
	label: string
}

export interface Comments {
	count: number
	/** Deep link to the item's discussion on the source. */
	url: string
	/** Singular noun, e.g. `comment` or `answer`. */
	label: string
}

export interface FeedItem {
	id: string
	title: string
	url: string
	description?: string
	score?: Count
	comments?: Comments
	/** Epoch milliseconds. */
	time?: number
	/** Short context such as a language, community or publisher. */
	tag?: string
	/** The rank on the source, if the feed does not start at 1. Without it the position in the list is shown. */
	rank?: number
}

export interface FetchContext {
	/** `high` for a column the reader is looking at, `low` for prefetches. */
	priority: RequestPriority
}

export interface SourceAdapter {
	fetch(ctx: FetchContext): Promise<FeedItem[]>
}

export interface SourceMeta {
	/** Stable id matching `[a-z0-9]+`. The settings cookie stores it. */
	id: string
	name: string
	tagline: string
	/** Lettermark shown in the round badge. */
	mark: string
	/** Badge background and foreground. */
	badge: readonly [background: string, foreground: string]
	/** Accent colours for the column title and ranks, one per theme. */
	accent: readonly [light: string, dark: string]
	home: string
	comments: boolean
	/** True if a workflow of this repository fetches the source, see `hosted.ts`. */
	hosted?: boolean
	/** Minutes a fetched feed counts as fresh. */
	ttl: number
}

/** Every source shows at most this many entries. */
export const LIMIT = 20
