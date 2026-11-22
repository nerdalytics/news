import { createUrlList } from './url-list'

const MAX_ENTRIES = 500

const list = createUrlList('thenews:hidden:v1', MAX_ENTRIES)

export const isHidden = (url: string): boolean => list.has(url)
export const hide = (url: string): void => list.add(url)
export const showAllHidden = (): void => list.clear()
export const hiddenCount = (): number => list.size()
