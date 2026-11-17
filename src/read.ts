import { createUrlList } from './url-list'

/** The list keeps this many of the most recently opened links. */
const MAX_ENTRIES = 500

/**
 * Tracks which entries the reader opened or marked as read. The app does not
 * use the browser's `:visited` state. That state misses links opened from a
 * home screen web app or a private window, and a script cannot clear it when
 * the reader marks an entry as unread.
 */
const list = createUrlList('thenews:read:v1', MAX_ENTRIES)

export const isRead = (url: string): boolean => list.has(url)
export const markRead = (url: string): void => list.add(url)
export const markUnread = (url: string): void => list.delete(url)
