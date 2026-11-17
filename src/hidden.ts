import { createUrlList } from './url-list'

/** The list keeps this many of the most recently hidden entries. */
const MAX_ENTRIES = 500

/** Entries the reader removed from the lists with a swipe. */
const list = createUrlList('tureel:hidden:v1', MAX_ENTRIES)

export const isHidden = (url: string): boolean => list.has(url)
export const hide = (url: string): void => list.add(url)
export const showAllHidden = (): void => list.clear()
export const hiddenCount = (): number => list.size()
