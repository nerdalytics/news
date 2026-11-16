import { sourceById } from '../sources/index'
import { Column } from './column'
import { el, prefersReducedMotion, whenIdle, withTransition } from './dom'

/** A column fetches only after staying on screen this long, so scrolling past it sends no request. */
const DWELL_MS = 150
/** After a programmatic jump, the deck ignores scroll events for this long. */
const QUIET_MS = 250

interface DeckOptions {
	deck: HTMLElement
	tabs: HTMLElement
	/** Called when the first column shows content or an error. */
	onFirstSettled: () => void
	onManage: () => void
}

function savesData(): boolean {
	const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
	return connection?.saveData === true
}

/**
 * The horizontally scrolling row of columns and its tab bar.
 *
 * Two IntersectionObservers on the scroll container decide when a column loads.
 * `viewObserver` activates a column that is at least half visible.
 * `rangeObserver` prefetches a column within half a viewport of the visible
 * area, once the reader has scrolled.
 */
export class Deck {
	private readonly columns = new Map<string, Column>()
	private readonly tabs = new Map<string, HTMLAnchorElement>()
	private readonly visible = new Set<string>()
	private readonly inRange = new Set<string>()
	private readonly viewObserver: IntersectionObserver
	private readonly rangeObserver: IntersectionObserver
	private order: string[] = []
	private engaged = false
	/** Scroll events before this time come from the app, not from the reader. */
	private quietUntil = 0
	private settled = false
	private firstView = true

	constructor(private readonly options: DeckOptions) {
		const root = options.deck
		this.viewObserver = new IntersectionObserver((entries) => this.onView(entries), {
			root,
			threshold: 0.5,
		})
		this.rangeObserver = new IntersectionObserver((entries) => this.onRange(entries), {
			root,
			rootMargin: '0px 50% 0px 50%',
		})
		// Scroll events do not bubble, but a capturing listener receives them. This
		// one sees the horizontal scroll of the deck and the vertical scroll of
		// every column.
		root.addEventListener('scroll', () => this.engage(), { capture: true, passive: true })
		options.tabs.addEventListener('click', (event) => this.onTabClick(event))
		// Prefetch a source when the pointer or keyboard focus reaches its tab.
		options.tabs.addEventListener('pointerover', (event) => this.onTabHint(event))
		options.tabs.addEventListener('focusin', (event) => this.onTabHint(event))
		addEventListener('hashchange', () => this.showFromHash())
		document.addEventListener('visibilitychange', () => this.onResume())
		addEventListener('pageshow', (event) => {
			if (event.persisted) this.onResume()
		})
	}

	/** Makes the deck show exactly these sources, in this order, reusing existing columns. */
	sync(ids: readonly string[]): void {
		const anchor = this.leftmost()
		this.order = ids.filter((id) => sourceById(id))
		this.removeStale()
		for (const [index, id] of this.order.entries()) this.place(id, index)
		this.options.deck.classList.toggle('is-empty', this.order.length === 0)
		this.renderEmptyState()
		this.renderTabs()
		const column = anchor ? this.columns.get(anchor) : undefined
		if (column) this.jumpTo(column.el.offsetLeft)
	}

	setNewTab(newTab: boolean): void {
		for (const column of this.columns.values()) column.setNewTab(newTab)
	}

	/** Jumps to the source named in the URL fragment, e.g. `#github`. */
	showFromHash(instant = false): void {
		const id = location.hash.slice(1)
		if (this.columns.has(id)) this.show(id, instant)
	}

	private removeStale(): void {
		for (const [id, column] of this.columns) {
			if (this.order.includes(id)) continue
			this.viewObserver.unobserve(column.el)
			this.rangeObserver.unobserve(column.el)
			column.el.remove()
			this.columns.delete(id)
			this.visible.delete(id)
			this.inRange.delete(id)
		}
	}

	private create(id: string): Column | undefined {
		const source = sourceById(id)
		if (!source) return undefined
		const column = new Column(source, () => this.onSettled())
		this.columns.set(id, column)
		this.viewObserver.observe(column.el)
		this.rangeObserver.observe(column.el)
		return column
	}

	private place(id: string, index: number): void {
		const deck = this.options.deck
		const existing = this.columns.get(id)
		const column = existing ?? this.create(id)
		if (!column) return
		const reference = deck.children[index] ?? null
		if (reference === column.el) return
		// `moveBefore` keeps the scroll position of a column that changes place.
		if (existing && 'moveBefore' in deck) deck.moveBefore(column.el, reference)
		else deck.insertBefore(column.el, reference)
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
			const badge = el('span', 'badge', source.mark)
			badge.style.setProperty('--badge-bg', source.badge[0])
			badge.style.setProperty('--badge-fg', source.badge[1])
			tab.append(badge, el('span', 'tab-name', source.name))
			this.tabs.set(id, tab)
			return [tab]
		})
		this.options.tabs.replaceChildren(...links)
		this.markTabs()
	}

	private tabId(event: Event): string | undefined {
		const tab = (event.target as Element).closest<HTMLElement>('.tab')
		return tab?.dataset.id
	}

	private onTabClick(event: MouseEvent): void {
		const id = this.tabId(event)
		if (!id || event.metaKey || event.ctrlKey || event.shiftKey) return
		event.preventDefault()
		// Tapping the tab of a source that is already in view scrolls its column to the top.
		if (this.visible.has(id)) this.columns.get(id)?.scrollToTop()
		else this.show(id)
	}

	private onTabHint(event: Event): void {
		const id = this.tabId(event)
		if (id && !savesData()) this.columns.get(id)?.prefetch()
	}

	private show(id: string, instant = false): void {
		const column = this.columns.get(id)
		if (!column) return
		const deck = this.options.deck
		const left = column.el.offsetLeft
		const near = Math.abs(left - deck.scrollLeft) <= deck.clientWidth * 1.5
		if (instant) this.jumpTo(left)
		else if (near && !prefersReducedMotion()) deck.scrollTo({ behavior: 'smooth', left })
		// A far jump cross-fades. A smooth scroll would pass through every column in between.
		else withTransition(() => deck.scrollTo({ behavior: 'instant', left }))
	}

	/** Moves the deck without animation. The scroll does not count as reader activity. */
	private jumpTo(left: number): void {
		this.quietUntil = performance.now() + QUIET_MS
		this.options.deck.scrollTo({ behavior: 'instant', left })
	}

	private leftmost(): string | undefined {
		return this.order.find((id) => this.visible.has(id))
	}

	private onView(entries: IntersectionObserverEntry[]): void {
		const immediate = this.firstView
		this.firstView = false
		for (const entry of entries) {
			const id = entry.target.id.replace('source-', '')
			if (!entry.isIntersecting) {
				this.visible.delete(id)
				continue
			}
			this.visible.add(id)
			if (immediate) this.columns.get(id)?.activate()
			else setTimeout(() => this.activateIfVisible(id), DWELL_MS)
		}
		this.markTabs()
		this.syncHash()
	}

	private activateIfVisible(id: string): void {
		if (this.visible.has(id)) this.columns.get(id)?.activate()
	}

	private onRange(entries: IntersectionObserverEntry[]): void {
		for (const entry of entries) {
			const id = entry.target.id.replace('source-', '')
			if (entry.isIntersecting) this.inRange.add(id)
			else this.inRange.delete(id)
		}
		if (this.engaged) this.prefetchInRange()
	}

	/** Runs on the reader's first scroll. From then on the deck prefetches columns close to the viewport. */
	private engage(): void {
		if (this.engaged || performance.now() < this.quietUntil) return
		this.engaged = true
		this.prefetchInRange()
	}

	private prefetchInRange(): void {
		if (savesData()) return
		whenIdle(() => {
			for (const id of this.inRange) {
				if (!this.visible.has(id)) this.columns.get(id)?.prefetch()
			}
		})
	}

	private markTabs(): void {
		const current = this.leftmost()
		for (const [id, tab] of this.tabs) {
			tab.classList.toggle('is-visible', this.visible.has(id))
			if (id === current) tab.setAttribute('aria-current', 'true')
			else tab.removeAttribute('aria-current')
		}
		const tab = current ? this.tabs.get(current) : undefined
		if (tab) this.revealTab(tab)
	}

	/** Scrolls the tab strip so the current tab is visible. It scrolls nothing else. */
	private revealTab(tab: HTMLElement): void {
		const strip = this.options.tabs
		const start = tab.offsetLeft - 12
		const end = tab.offsetLeft + tab.offsetWidth + 12
		if (start < strip.scrollLeft) strip.scrollTo({ left: start })
		else if (end > strip.scrollLeft + strip.clientWidth) {
			strip.scrollTo({ left: end - strip.clientWidth })
		}
	}

	/** Writes the current source to the URL fragment, so a reload or a shared link opens the same source. */
	private syncHash(): void {
		const current = this.leftmost()
		if (!current || !this.engaged) return
		if (location.hash.slice(1) !== current) history.replaceState(null, '', `#${current}`)
	}

	private onSettled(): void {
		if (this.settled) return
		this.settled = true
		this.options.onFirstSettled()
	}

	/** Refreshes the visible columns when the reader returns from another tab, another app or the back/forward cache. */
	private onResume(): void {
		if (document.visibilityState !== 'visible') return
		for (const id of this.visible) this.columns.get(id)?.activate()
	}
}
