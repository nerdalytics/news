import { sourceById } from '../sources/index'
import { Column } from './column'
import { el, prefersReducedMotion, whenIdle, withTransition } from './dom'

/** A column must stay on screen this long before it fetches, so fly-bys cost nothing. */
const DWELL_MS = 150
/** How long after a programmatic jump scroll events are not taken as reader activity. */
const QUIET_MS = 250

interface DeckOptions {
	deck: HTMLElement
	tabs: HTMLElement
	/** A column showed content or an error for the first time. */
	onFirstSettled: () => void
	onManage: () => void
}

function savesData(): boolean {
	const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
	return connection?.saveData === true
}

/**
 * The horizontally scrolling row of columns plus its tab bar.
 *
 * Loading is driven by two IntersectionObservers on the scroll container:
 * - `viewObserver`: a column that is at least half visible is active and loads.
 * - `rangeObserver`: a column within half a viewport of the visible area is
 *   prefetched once the reader has started scrolling.
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
	/** Scroll events before this moment come from the app itself, not from the reader. */
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
		// Scroll events do not bubble, but they can be captured: this sees both the
		// horizontal deck scroll and the vertical scroll of any column.
		root.addEventListener('scroll', () => this.engage(), { capture: true, passive: true })
		options.tabs.addEventListener('click', (event) => this.onTabClick(event))
		// Desktop: pointing at or focusing a tab is a strong hint.
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
			el('h2', undefined, 'No sources yet'),
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
		// A second tap on a source that is already in view scrolls it back to the top.
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
		// Far jumps cross-fade instead of racing past every column in between.
		else withTransition(() => deck.scrollTo({ behavior: 'instant', left }))
	}

	/** Repositions the deck without animation and without counting as reader activity. */
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

	/** First scroll of the session: from now on, columns close to the viewport are warmed up. */
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

	/** Keeps the current tab inside the scrolling tab strip without moving anything else. */
	private revealTab(tab: HTMLElement): void {
		const strip = this.options.tabs
		const start = tab.offsetLeft - 12
		const end = tab.offsetLeft + tab.offsetWidth + 12
		if (start < strip.scrollLeft) strip.scrollTo({ left: start })
		else if (end > strip.scrollLeft + strip.clientWidth) {
			strip.scrollTo({ left: end - strip.clientWidth })
		}
	}

	/** Mirrors the current source into the fragment so a reload or shared link returns to it. */
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

	/** Back from another tab, app or the back/forward cache: refresh what is on screen. */
	private onResume(): void {
		if (document.visibilityState !== 'visible') return
		for (const id of this.visible) this.columns.get(id)?.activate()
	}
}
