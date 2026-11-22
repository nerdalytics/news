import { createUrlList } from './url-list'

const MAX_ENTRIES = 500

const list = createUrlList('thenews:read:v1', MAX_ENTRIES)

export const isRead = (url: string): boolean => list.has(url)
export const markRead = (url: string): void => list.add(url)
export const markUnread = (url: string): void => list.delete(url)
