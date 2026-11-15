import { safeUrl } from '../format'
import { getJson } from '../net'
import { type FeedItem, LIMIT, type SourceAdapter } from './types'

/** Lemmy HTTP API v3 on lemmy.world. A few extra posts make up for filtered ones. */
const INSTANCE = 'https://lemmy.world'
const ENDPOINT = `${INSTANCE}/api/v3/post/list?community_name=technology&sort=Hot&limit=${LIMIT + 10}`

interface PostView {
	post: {
		id: number
		name: string
		url?: string | null
		published?: string
		nsfw?: boolean
		removed?: boolean
		deleted?: boolean
		/** Pinned by the community moderators. */
		featured_community?: boolean
	}
	counts: { comments: number; score: number }
}

export interface ListResponse {
	posts: PostView[]
}

function isListed({ post }: PostView): boolean {
	return !(post.nsfw || post.removed || post.deleted || post.featured_community)
}

function toItem({ post, counts }: PostView): FeedItem {
	// The post page on this instance, not `ap_id`: that may point to another server.
	const discussion = `${INSTANCE}/post/${post.id}`
	const item: FeedItem = {
		id: String(post.id),
		title: post.name,
		url: safeUrl(post.url) ?? discussion,
		comments: { count: counts.comments, label: 'comment', url: discussion },
		score: { label: 'point', value: counts.score },
	}
	if (post.published) item.time = Date.parse(post.published)
	return item
}

/** The same link is often cross-posted from several instances; keep the hottest one. */
function uniqueByUrl(items: FeedItem[]): FeedItem[] {
	const seen = new Set<string>()
	return items.filter((item) => !seen.has(item.url) && seen.add(item.url))
}

export function parse(response: ListResponse): FeedItem[] {
	return uniqueByUrl(response.posts.filter(isListed).map(toItem)).slice(0, LIMIT)
}

const adapter: SourceAdapter = {
	async fetch(ctx) {
		return parse(await getJson<ListResponse>(ENDPOINT, ctx))
	},
}

export default adapter
