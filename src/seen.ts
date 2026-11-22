import { createUrlList, type UrlList } from './url-list'

const MAX_ENTRIES = 200

const lists = new Map<string, UrlList>()

function listFor(sourceId: string): UrlList {
	let list = lists.get(sourceId)
	if (!list) {
		list = createUrlList(`thenews:seen:v1:${sourceId}`, MAX_ENTRIES)
		lists.set(sourceId, list)
	}
	return list
}

export function isSeen(sourceId: string, url: string): boolean {
	return listFor(sourceId).has(url)
}

export function markSeen(sourceId: string, urls: readonly string[]): void {
	if (urls.length > 0) listFor(sourceId).addAll(urls)
}
