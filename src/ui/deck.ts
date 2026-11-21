import { hide } from '../hidden'
import { markRead, markUnread } from '../read'
import { getSettings, isBlocked, isFavorite, setBlocked, setFavorite } from '../settings'
import { sourceById } from '../sources/index'
import { Column } from './column'
import { el, popBadge, prefersReducedMotion, slideView, whenIdle } from './dom'
import { navDirection, type SwipeAction } from './gestures'
import { capacity, topsChanged, windowStart, windowStep } from './layout'
import { openInBrowser } from './open'

interface DeckOptions {
	deck: HTMLElement
	tabs: HTMLElement
	/** Called when the first column shows content or an error. */
	onFirstSettled: () => void
	onManage: () => void
	/** The reader tapped the name of a linked site. */
	onSite: (site: string) => void
	/** The deck scrolled the page itself, for example to restore a position. */
	onJump: () => void
}

/** The CSS custom property that holds the smallest width of a column. */
const COLUMN_MIN = '--column-min'
/** Space kept on both sides of the current tab when the strip scrolls it into view. */
const TAB_MARGIN_PX = 12

const SWIPE_LABELS: Record<SwipeAction, string> = {
	block: 'Block site',
	browser: 'Open in browser',
	comments: 'Comments',
	favorite: 'Favorite site',
	hide: 'Hide',
	next: 'Next source',
	previous: 'Previous source',
	read: 'Read',
	unread: 'Unread',
}

function savesData(): boolean {
	const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
	return connection?.saveData === true
}

function scrollBehavior(): ScrollBehavior {
	return prefersReducedMotion() ? 'instant' : 'smooth'
}

/**
 * The columns and their tab bar.
 *
 * The deck is a CSS grid that fits as many columns as the width allows, with
 * no breakpoints. The deck displays that many consecutive sources, starting at
 * the one the reader chose, and hides the others. A phone fits one column, a
 * wide screen several. The page itself scrolls in every case.
 *
 * The displayed sources load first. The other sources are then fetched one
 * after another at low priority.
 */
export class Deck {
	private readonly columns = new Map<string, Column>()
	private readonly tabs = new Map<string, HTMLAnchorElement>()
	/** The sources that are displayed right now. */
	private visible = new Set<string>()
	/** The page scroll position the reader left, keyed by the first displayed source. */
	private readonly scrollTops = new Map<string, number>()
	/** The top entry id the reader last saw per source, to spot new arrivals on re-visit. */
	private readonly lastSeenTop = new Map<string, string>()
	private order: string[] = []
	/** The source the reader chose last. It is always displayed. */
	private current: string | undefined
	/** How many columns fit side by side. */
	private size = 1
	private settled = false
	private prefetching = false
	private prefetchAgain = false

	constructor(private readonly options: DeckOptions) {
		new ResizeObserver(() => this.onResize()).observe(options.deck)
		options.tabs.addEventListener('click', (event) => this.onTabClick(event))
		options.deck.addEventListener('click', (event) => this.onItemClick(event))
		// A middle click opens the link in a new tab and fires `auxclick`, not `click`.
		options.deck.addEventListener('auxclick', (event) => this.onItemClick(event))
		addEventListener('hashchange', () => this.showFromHash())
		document.addEventListener('visibilitychange', () => this.onResume())
		addEventListener('pageshow', (event) => {
			if (event.persisted) this.onResume()
		})
	}

	/** Makes the deck show exactly these sources, in this order, reusing existing columns. */
	sync(ids: readonly string[]): void {
		this.order = ids.filter((id) => sourceById(id))
		this.removeStale()
		for (const [index, id] of this.order.entries()) this.place(id, index)
		this.renderEmptyState()
		this.renderTabs()
		if (!this.current || !this.columns.has(this.current)) {
			this.current = this.order[0]
			scrollTo({ behavior: 'instant', top: 0 })
		}
		this.size = this.measure()
		this.applyLayout()
		if (this.settled) this.prefetchOthers()
	}

	setNewTab(newTab: boolean): void {
		for (const column of this.columns.values()) column.setNewTab(newTab)
	}

	/** Re-applies the read and blocked marks in every column. */
	restyle(): void {
		for (const column of this.columns.values()) column.restyle()
	}

	/** Fetches the feed of the column behind a column element again. */
	refresh(element: HTMLElement): Promise<void> {
		const id = element.id.replace('source-', '')
		return this.columns.get(id)?.refresh() ?? Promise.resolve()
	}

	/** False if a swipe action has nothing to act on in this row. */
	swipeApplies(row: HTMLElement, action: SwipeAction): boolean {
		// A source swipe moves the whole view, so it needs a source off screen.
		if (action === 'next' || action === 'previous') return this.order.length > this.size
		if (action === 'block' || action === 'favorite') return row.dataset.site !== undefined
		if (action === 'comments') return row.querySelector('a.comments') !== null
		return row.dataset.url !== undefined
	}

	/** The words shown behind a row while a swipe would carry out this action. */
	swipeLabel(row: HTMLElement, action: SwipeAction): string {
		const site = row.dataset.site
		if (action === 'block' && site) return isBlocked(site) ? `Unblock ${site}` : `Block ${site}`
		if (action === 'favorite' && site)
			return isFavorite(site) ? `Unfavorite ${site}` : `Favorite ${site}`
		return SWIPE_LABELS[action]
	}

	/** Carries out a swipe on a row. */
	swipe(row: HTMLElement, action: SwipeAction): void {
		if (action === 'next' || action === 'previous') {
			this.step(action === 'next' ? 1 : -1)
			return
		}
		const { site, url } = row.dataset
		if (!url) return
		const comments = row.querySelector<HTMLAnchorElement>('a.comments')?.href
		if (action === 'read') markRead(url)
		else if (action === 'unread') markUnread(url)
		else if (action === 'hide') hide(url)
		else if (action === 'block' && site) setBlocked(site, !isBlocked(site))
		else if (action === 'favorite' && site) setFavorite(site, !isFavorite(site))
		else if (action === 'comments' && comments) this.navigate(comments)
		else if (action === 'browser') openInBrowser(url)
		// The same link can appear in several sources.
		this.restyle()
	}

	/**
	 * Swipes the whole view one source forward or back, wrapping around the ends.
	 * The window moves, not the swiped column, so the gesture works from every
	 * column and never lands on a source that is already displayed.
	 */
	private step(delta: 1 | -1): void {
		const count = this.order.length
		if (count < 2) return
		const index = this.current ? this.order.indexOf(this.current) : 0
		const target = this.order[windowStep(index, count, this.size, delta)]
		if (!target) return
		this.show(target)
		this.writeHash(target)
	}

	/** Follows a link the way a tap on it would. */
	private navigate(url: string): void {
		if (getSettings().newTab) window.open(url, '_blank', 'noopener')
		else location.assign(url)
	}

	private onItemClick(event: MouseEvent): void {
		const target = event.target as Element
		const site = target.closest<HTMLElement>('.site')?.dataset.site
		if (site) {
			this.options.onSite(site)
			return
		}
		const title = target.closest<HTMLAnchorElement>('a.title')
		if (!title || event.button > 1) return
		markRead(title.href)
		// The same link can appear in several sources.
		this.restyle()
	}

	/** Opens the source named in the URL fragment, e.g. `#github`. */
	showFromHash(): void {
		const id = location.hash.slice(1)
		if (this.columns.has(id)) this.show(id)
	}

	private removeStale(): void {
		for (const [id, column] of this.columns) {
			if (this.order.includes(id)) continue
			column.el.remove()
			this.columns.delete(id)
			this.visible.delete(id)
			this.scrollTops.delete(id)
			this.lastSeenTop.delete(id)
		}
	}

	private create(id: string): Column | undefined {
		const source = sourceById(id)
		if (!source) return undefined
		const column = new Column(source, () => this.onSettled())
		this.columns.set(id, column)
		return column
	}

	private place(id: string, index: number): void {
		const deck = this.options.deck
		const existing = this.columns.get(id)
		const column = existing ?? this.create(id)
		if (!column) return
		const reference = deck.children[index] ?? null
		if (reference === column.el) return
		deck.insertBefore(column.el, reference)
	}

	private renderEmptyState(): void {
		const deck = this.options.deck
		deck.querySelector('.empty')?.remove()
		if (this.order.length > 0) return
		const empty = el('div', 'empty')
		const button = el('button', 'primary-btn', 'Manage sources')
		button.type = 'button'
		button.addEventListener('click', () => this.options.onManage())
		empty.append(
			el('h2', undefined, 'No sources enabled'),
			el('p', undefined, 'Switch on at least one source to start reading.'),
			button
		)
		deck.append(empty)
	}

	private renderTabs(): void {
		this.tabs.clear()
		const links = this.order.flatMap((id) => {
			const source = sourceById(id)
			if (!source) return []
			const tab = el('a', 'tab')
			tab.href = `#${id}`
			tab.dataset.id = id
			tab.addEventListener('animationend', () => tab.classList.remove('is-tapped'))
			const badge = el('span', 'badge', source.mark)
			badge.style.setProperty('--badge-bg', source.badge[0])
			badge.style.setProperty('--badge-fg', source.badge[1])
			tab.append(badge, el('span', 'visually-hidden', source.name))
			this.tabs.set(id, tab)
			return [tab]
		})
		this.options.tabs.replaceChildren(...links)
	}

	/** Reads the smallest column width from CSS and returns how many columns fit. */
	private measure(): number {
		const deck = this.options.deck
		const value = getComputedStyle(deck).getPropertyValue(COLUMN_MIN)
		// The property is registered as a length, so its computed value is in pixels.
		const columnMin = value.endsWith('px') ? Number.parseFloat(value) : Number.NaN
		return capacity(deck.getBoundingClientRect().width, columnMin)
	}

	private onResize(): void {
		const size = this.measure()
		if (size === this.size) return
		this.size = size
		this.applyLayout()
	}

	/** The sources to display: as many as fit, starting at the current one. */
	private window(): string[] {
		const index = this.current ? this.order.indexOf(this.current) : 0
		const start = windowStart(index, this.order.length, this.size)
		return this.order.slice(start, start + this.size)
	}

	/** Displays the window of sources, hides the others and loads what is displayed. */
	private applyLayout(): void {
		this.visible = new Set(this.window())
		for (const [id, column] of this.columns) {
			column.el.hidden = !this.visible.has(id)
			if (this.visible.has(id)) void column.activate()
		}
		this.markTabs()
	}

	private onTabClick(event: MouseEvent): void {
		const tab = (event.target as Element).closest<HTMLElement>('.tab')
		const id = tab?.dataset.id
		if (!id || event.metaKey || event.ctrlKey || event.shiftKey) return
		event.preventDefault()
		if (tab) popBadge(tab)
		// Tapping the tab of a source that is already displayed scrolls to the top.
		if (this.visible.has(id)) scrollTo({ behavior: scrollBehavior(), top: 0 })
		else this.show(id, true)
		this.writeHash(id)
	}

	/** Displays a source and restores the scroll position the reader left there.
	   A tap slides the deck; a swipe already glides via --dx, so it updates at once. */
	private show(id: string, animate = false): void {
		if (!this.columns.has(id)) return
		const from = this.current ? this.order.indexOf(this.current) : 0
		const to = this.order.indexOf(id)
		const update = (): void => {
			const previous = this.window()[0]
			if (previous) this.scrollTops.set(previous, scrollY)
			this.current = id
			this.applyLayout()
			const first = this.window()[0]
			const top = this.columns.get(id)?.topItemId()
			const seen = this.lastSeenTop.get(id)
			// New arrivals since the reader last looked start at the top; an unchanged feed keeps their place.
			const target = topsChanged(top, seen) ? 0 : (first && this.scrollTops.get(first)) || 0
			scrollTo({ behavior: 'instant', top: target })
			if (top !== undefined) this.lastSeenTop.set(id, top)
			this.options.onJump()
		}
		// Never start a transition while a swipe is still gliding home.
		if (animate && !this.options.deck.hasAttribute('data-settling')) {
			slideView(update, navDirection(from, to))
		} else {
			update()
		}
	}

	private markTabs(): void {
		for (const [id, tab] of this.tabs) {
			tab.classList.toggle('is-visible', this.visible.has(id))
			if (id === this.current) tab.setAttribute('aria-current', 'true')
			else tab.removeAttribute('aria-current')
		}
		const tab = this.current ? this.tabs.get(this.current) : undefined
		if (tab) this.revealTab(tab)
	}

	/** Scrolls the tab strip so the current tab is visible. It scrolls nothing else. */
	private revealTab(tab: HTMLElement): void {
		const strip = this.options.tabs
		const start = tab.offsetLeft - TAB_MARGIN_PX
		const end = tab.offsetLeft + tab.offsetWidth + TAB_MARGIN_PX
		if (start < strip.scrollLeft) strip.scrollTo({ left: start })
		else if (end > strip.scrollLeft + strip.clientWidth) {
			strip.scrollTo({ left: end - strip.clientWidth })
		}
	}

	/** Writes the source to the URL fragment, so a reload or a shared link opens it again. */
	private writeHash(id: string): void {
		if (location.hash.slice(1) !== id) history.replaceState(null, '', `#${id}`)
	}

	private onSettled(): void {
		if (this.settled) return
		this.settled = true
		this.options.onFirstSettled()
		whenIdle(() => this.prefetchOthers())
	}

	/** Sources that are not displayed, nearest to the current one first. */
	private othersByDistance(): string[] {
		const origin = this.current ? this.order.indexOf(this.current) : 0
		return this.order
			.filter((id) => !this.visible.has(id))
			.sort(
				(a, b) =>
					Math.abs(this.order.indexOf(a) - origin) - Math.abs(this.order.indexOf(b) - origin)
			)
	}

	/**
	 * Fetches the sources that are not displayed, one at a time, so they are ready
	 * when the reader switches. A fresh cached feed costs no request.
	 */
	private async prefetchOthers(): Promise<void> {
		if (savesData()) return
		if (this.prefetching) {
			this.prefetchAgain = true
			return
		}
		this.prefetching = true
		for (const id of this.othersByDistance()) await this.columns.get(id)?.prefetch()
		this.prefetching = false
		if (!this.prefetchAgain) return
		this.prefetchAgain = false
		void this.prefetchOthers()
	}

	/** Refreshes the feeds when the reader returns from another tab, another app or the back/forward cache. */
	private onResume(): void {
		if (document.visibilityState !== 'visible') return
		for (const id of this.visible) void this.columns.get(id)?.activate()
		void this.prefetchOthers()
	}
}
