export interface Count {
	value: number
	label: string
}

export interface Comments {
	count: number
	url: string
	label: string
}

export interface FeedItem {
	id: string
	title: string
	url: string
	description?: string
	score?: Count
	comments?: Comments
	time?: number
	tag?: string
	rank?: number
}

export interface FetchContext {
	priority: RequestPriority
}

export interface SourceAdapter {
	fetch(ctx: FetchContext): Promise<FeedItem[]>
}

export interface SourceMeta {
	id: string
	name: string
	tagline: string
	mark: string
	badge: readonly [background: string, foreground: string]
	accent: readonly [light: string, dark: string]
	home: string
	comments: boolean
	hosted?: boolean
	ttl: number
}

export const LIMIT = 20
