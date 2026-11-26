import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { hiddenCount, isHidden } from '../src/hidden'
import { isRead } from '../src/read'
import {
	DESC_MAX,
	isBlocked,
	isFavorite,
	setBlocked,
	setFavorite,
	updateSettings,
} from '../src/settings'
import { temperature } from '../src/temperature'
import { Deck } from '../src/ui/deck'
import { SWIPE_LABELS } from '../src/ui/gestures'
import { openInBrowser } from '../src/ui/open'

vi.mock('../src/ui/column', () => ({
	Column: class {
		el: HTMLElement
		constructor(source: { id: string }) {
			this.el = document.createElement('section')
			this.el.id = `source-${source.id}`
		}
		activate(): Promise<void> {
			return Promise.resolve()
		}
		refresh(): Promise<void> {
			return Promise.resolve()
		}
		prefetch(): Promise<void> {
			return Promise.resolve()
		}
		setVisible(visible: boolean): void {
			this.el.dataset.visible = String(visible)
		}
		endVisit(): void {}
		restyle(): void {
			this.el.dataset.restyled = String(Number(this.el.dataset.restyled ?? '0') + 1)
		}
		topItemId(): string | undefined {
			return undefined
		}
		setNewTab(newTab: boolean): void {
			this.el.dataset.newTab = String(newTab)
		}
	},
}))
vi.mock('../src/ui/open', () => ({ openInBrowser: vi.fn() }))

function makeDeck() {
	const deckEl = document.createElement('main')
	const tabsEl = document.createElement('nav')
	document.body.append(deckEl, tabsEl)
	const onManage = vi.fn()
	const onSite = vi.fn()
	const onJump = vi.fn()
	const onFirstSettled = vi.fn()
	const deck = new Deck({ deck: deckEl, tabs: tabsEl, onFirstSettled, onManage, onSite, onJump })
	return { deck, deckEl, tabsEl, onManage, onSite, onJump, onFirstSettled }
}

function row(dataset: { url?: string; site?: string }, commentsHref?: string): HTMLElement {
	const node = document.createElement('article')
	if (dataset.url) node.dataset.url = dataset.url
	if (dataset.site) node.dataset.site = dataset.site
	if (commentsHref) {
		const link = document.createElement('a')
		link.className = 'comments'
		link.href = commentsHref
		node.append(link)
	}
	return node
}

function currentTabId(tabsEl: HTMLElement): string | undefined {
	return tabsEl.querySelector<HTMLElement>('[aria-current="true"]')?.dataset.id
}

beforeEach(() => {
	vi.clearAllMocks()
	localStorage.clear()
	vi.stubGlobal(
		'matchMedia',
		vi.fn(() => ({ matches: false, addEventListener() {}, removeEventListener() {} }))
	)
	vi.stubGlobal(
		'ResizeObserver',
		class {
			observe() {}
			unobserve() {}
			disconnect() {}
		}
	)
	vi.stubGlobal('scrollTo', vi.fn())
	Element.prototype.scrollTo = vi.fn()
	vi.spyOn(window, 'open').mockImplementation(() => null)
	updateSettings({
		theme: 'auto',
		newTab: false,
		descLines: DESC_MAX,
		showStatus: true,
		swipe: {},
		sources: [
			{ id: 'hn', enabled: true },
			{ id: 'github', enabled: true },
		],
	})
})

afterEach(() => {
	vi.restoreAllMocks()
	vi.unstubAllGlobals()
	Reflect.deleteProperty(Element.prototype, 'scrollTo')
	document.body.replaceChildren()
	localStorage.clear()
	location.hash = ''
})

describe('swipeApplies', () => {
	it('allows next and previous only when more sources exist than fit the window', () => {
		const { deck } = makeDeck()
		const node = row({ url: 'https://applies.example/' })
		expect(deck.swipeApplies(node, 'next')).toBe(false)
		expect(deck.swipeApplies(node, 'previous')).toBe(false)
		deck.sync(['hn', 'github'])
		expect(deck.swipeApplies(node, 'next')).toBe(true)
		expect(deck.swipeApplies(node, 'previous')).toBe(true)
	})

	it('gates block and favorite on a site, comments on a comments link, the rest on a url', () => {
		const { deck } = makeDeck()
		const bare = row({})
		expect(deck.swipeApplies(bare, 'block')).toBe(false)
		expect(deck.swipeApplies(bare, 'favorite')).toBe(false)
		expect(deck.swipeApplies(bare, 'comments')).toBe(false)
		expect(deck.swipeApplies(bare, 'read')).toBe(false)
		const full = row({ url: 'https://full.example/', site: 'full.example' }, 'https://c.example/')
		expect(deck.swipeApplies(full, 'block')).toBe(true)
		expect(deck.swipeApplies(full, 'favorite')).toBe(true)
		expect(deck.swipeApplies(full, 'comments')).toBe(true)
		expect(deck.swipeApplies(full, 'read')).toBe(true)
		expect(deck.swipeApplies(full, 'hide')).toBe(true)
		expect(deck.swipeApplies(full, 'browser')).toBe(true)
	})
})

describe('swipeLabel', () => {
	it('flips between Block and Unblock with the stored state', () => {
		const { deck } = makeDeck()
		const node = row({ site: 'label-block.example' })
		expect(deck.swipeLabel(node, 'block')).toBe('Block')
		setBlocked('label-block.example', true)
		expect(deck.swipeLabel(node, 'block')).toBe('Unblock')
	})

	it('flips between Favorite and Unfavorite with the stored state', () => {
		const { deck } = makeDeck()
		const node = row({ site: 'label-fav.example' })
		expect(deck.swipeLabel(node, 'favorite')).toBe('Favorite')
		setFavorite('label-fav.example', true)
		expect(deck.swipeLabel(node, 'favorite')).toBe('Unfavorite')
	})

	it('uses the shared label for the remaining actions', () => {
		const { deck } = makeDeck()
		const node = row({ url: 'https://label.example/' })
		expect(deck.swipeLabel(node, 'read')).toBe(SWIPE_LABELS.read)
		expect(deck.swipeLabel(node, 'next')).toBe(SWIPE_LABELS.next)
	})
})

describe('swipe effects', () => {
	it('marks the url read and unread', () => {
		const { deck } = makeDeck()
		const url = 'https://read-swipe.example/'
		deck.swipe(row({ url }), 'read')
		expect(isRead(url)).toBe(true)
		deck.swipe(row({ url }), 'unread')
		expect(isRead(url)).toBe(false)
	})

	it('hides the url', () => {
		const { deck } = makeDeck()
		const url = 'https://hide-swipe.example/'
		deck.swipe(row({ url }), 'hide')
		expect(isHidden(url)).toBe(true)
		expect(hiddenCount()).toBe(1)
	})

	it('toggles block and favorite on the site', () => {
		const { deck } = makeDeck()
		const node = row({ url: 'https://toggle.example/', site: 'toggle.example' })
		deck.swipe(node, 'block')
		expect(isBlocked('toggle.example')).toBe(true)
		deck.swipe(node, 'block')
		expect(isBlocked('toggle.example')).toBe(false)
		deck.swipe(node, 'favorite')
		expect(isFavorite('toggle.example')).toBe(true)
		deck.swipe(node, 'favorite')
		expect(isFavorite('toggle.example')).toBe(false)
	})

	it('opens the comments link in a new tab when the setting says so', () => {
		updateSettings({ newTab: true })
		const { deck } = makeDeck()
		const node = row({ url: 'https://item.example/' }, 'https://comments.example/')
		deck.swipe(node, 'comments')
		expect(window.open).toHaveBeenCalledWith('https://comments.example/', '_blank', 'noopener')
	})

	it('delegates browser to openInBrowser', () => {
		const { deck } = makeDeck()
		const url = 'https://browser-swipe.example/'
		deck.swipe(row({ url }), 'browser')
		expect(openInBrowser).toHaveBeenCalledWith(url)
	})

	it('does nothing without a url', () => {
		const { deck, deckEl } = makeDeck()
		deck.sync(['hn'])
		deck.swipe(row({}), 'read')
		expect(openInBrowser).not.toHaveBeenCalled()
		expect(deckEl.querySelector<HTMLElement>('#source-hn')?.dataset.restyled).toBeUndefined()
	})

	it('restyles the columns after a row action', () => {
		const { deck, deckEl } = makeDeck()
		deck.sync(['hn'])
		deck.swipe(row({ url: 'https://restyle.example/' }), 'read')
		expect(deckEl.querySelector<HTMLElement>('#source-hn')?.dataset.restyled).toBe('1')
	})
})

describe('next and previous stepping', () => {
	it('steps through the order, wraps at both ends and writes the hash', () => {
		const { deck, tabsEl } = makeDeck()
		deck.sync(['hn', 'github'])
		expect(currentTabId(tabsEl)).toBe('hn')
		deck.swipe(row({}), 'next')
		expect(location.hash).toBe('#github')
		expect(currentTabId(tabsEl)).toBe('github')
		deck.swipe(row({}), 'next')
		expect(location.hash).toBe('#hn')
		deck.swipe(row({}), 'previous')
		expect(location.hash).toBe('#github')
	})

	it('stays put with a single source', () => {
		const { deck } = makeDeck()
		deck.sync(['hn'])
		deck.swipe(row({}), 'next')
		expect(location.hash).toBe('')
	})
})

describe('sync, tabs and hash', () => {
	it('filters unknown ids, renders columns and tabs in order', () => {
		const { deck, deckEl, tabsEl } = makeDeck()
		deck.sync(['hn', 'zzz', 'github'])
		expect(Array.from(deckEl.children).map((node) => node.id)).toEqual([
			'source-hn',
			'source-github',
		])
		expect(
			Array.from(tabsEl.querySelectorAll<HTMLElement>('.tab')).map((node) => node.dataset.id)
		).toEqual(['hn', 'github'])
		expect(currentTabId(tabsEl)).toBe('hn')
	})

	it('shows the empty state and routes its button to onManage', () => {
		const { deck, deckEl, onManage } = makeDeck()
		deck.sync([])
		expect(deckEl.querySelector('.empty h2')?.textContent).toBe('No sources enabled')
		deckEl.querySelector<HTMLButtonElement>('.empty button')?.click()
		expect(onManage).toHaveBeenCalledWith()
	})

	it('switches source on tab click, hiding the previous column', () => {
		const { deck, deckEl, tabsEl } = makeDeck()
		deck.sync(['hn', 'github'])
		tabsEl.querySelector<HTMLElement>('.tab[data-id="github"]')?.click()
		expect(location.hash).toBe('#github')
		expect(deckEl.querySelector<HTMLElement>('#source-hn')?.hidden).toBe(true)
		expect(deckEl.querySelector<HTMLElement>('#source-github')?.hidden).toBe(false)
	})

	it('follows the hash to a known source and ignores unknown ones', async () => {
		const { deck, tabsEl } = makeDeck()
		deck.sync(['hn', 'github'])
		location.hash = '#github'
		await vi.waitFor(() => expect(currentTabId(tabsEl)).toBe('github'))
		location.hash = '#zzz'
		await new Promise((resolve) => setTimeout(resolve, 0))
		expect(currentTabId(tabsEl)).toBe('github')
	})

	it('propagates setNewTab to every column', () => {
		const { deck, deckEl } = makeDeck()
		deck.sync(['hn', 'github'])
		deck.setNewTab(true)
		expect(deckEl.querySelector<HTMLElement>('#source-hn')?.dataset.newTab).toBe('true')
		expect(deckEl.querySelector<HTMLElement>('#source-github')?.dataset.newTab).toBe('true')
	})
})

describe('read heat', () => {
	function column(deckEl: HTMLElement): HTMLElement {
		return deckEl.querySelector<HTMLElement>('#source-hn') as HTMLElement
	}

	it('records heat for swipe read, comments and browser but not unread', () => {
		updateSettings({ newTab: true })
		const { deck, deckEl } = makeDeck()
		deck.sync(['hn'])
		const host = column(deckEl)
		const attach = (comments?: string): HTMLElement => {
			const node = row({ url: 'https://heat.example/' }, comments)
			host.append(node)
			return node
		}
		deck.swipe(attach(), 'read')
		deck.swipe(attach('https://comments.example/'), 'comments')
		deck.swipe(attach(), 'browser')
		deck.swipe(attach(), 'unread')
		expect(temperature('hn', 'all')).toBe(3)
	})

	it('records heat on title and comments link clicks', () => {
		const { deck, deckEl } = makeDeck()
		deck.sync(['hn'])
		const host = column(deckEl)
		const title = document.createElement('a')
		title.className = 'title'
		title.href = 'https://title.example/'
		host.append(title)
		title.click()
		expect(isRead('https://title.example/')).toBe(true)
		expect(temperature('hn', 'all')).toBe(1)
		const comments = document.createElement('a')
		comments.className = 'comments'
		comments.href = 'https://comments.example/'
		host.append(comments)
		comments.click()
		expect(temperature('hn', 'all')).toBe(2)
	})
})
