import { markRead } from '../read'
import { sourceById } from '../sources/index'
import { Column } from './column'
import { el, prefersReducedMotion, whenIdle } from './dom'

interface DeckOptions {
	deck: HTMLElement
	tabs: HTMLElement
	/** Called when the first column shows content or an error. */
	onFirstSettled: () => void
	onManage: () => void
	/** The reader tapped the name of a linked site. */
	onSite: (site: string) => void
}

/** From this width on, several columns sit side by side and scroll on their own. */
const WIDE = matchMedia('(min-width: 760px)')

function savesData(): boolean {
	const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
	return connection?.saveData === true
}

function scrollBehavior(): ScrollBehavior {
	return prefersReducedMotion() ? 'instant' : 'smooth'
}

/**
 * The columns and their tab bar. It has two layouts.
 *
 * On phones only the current source is displayed and the document scrolls, so
 * the browser's own page scrolling does all the work. Switching sources swaps
 * the displayed column and restores its scroll position.
 *
 * On wide screens all columns sit in a horizontally scrolling row. An
 * IntersectionObserver reports which columns are in view.
 *
 * In both layouts the current source loads first. The other sources are then
 * fetched one after another at low priority.
 */
export class Deck {
	private readonly columns = new Map<string, Column>()
	private readonly tabs = new Map<string, HTMLAnchorElement>()
	/** Sources in view on wide screens. On phones this is the current source. */
	private readonly visible = new Set<string>()
	/** Where the reader left each source on phones. */
	private readonly scrollTops = new Map<string, number>()
	private readonly viewObserver: IntersectionObserver
	private order: string[] = []
	private current: string | undefined
	private settled = false
	private prefetching = false
	private prefetchAgain = false

	constructor(private readonly options: DeckOptions) {
		this.viewObserver = new IntersectionObserver((entries) => this.onView(entries), {
			root: options.deck,
			threshold: 0.5,
		})
		options.tabs.addEventListener('click', (event) => this.onTabClick(event))
		options.deck.addEventListener('click', (event) => this.onItemClick(event))
		// A middle click opens the link in a new tab and fires `auxclick`, not `click`.
		options.deck.addEventListener('auxclick', (event) => this.onItemClick(event))
		WIDE.addEventListener('change', () => this.applyLayout())
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
			if (!WIDE.matches) scrollTo({ behavior: 'instant', top: 0 })
		}
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
		if (this.columns.has(id)) this.show(id, 'instant')
	}

	private removeStale(): void {
		for (const [id, column] of this.columns) {
			if (this.order.includes(id)) continue
			this.viewObserver.unobserve(column.el)
			column.el.remove()
			this.columns.delete(id)
			this.visible.delete(id)
			this.scrollTops.delete(id)
		}
	}

	private create(id: string): Column | undefined {
		const source = sourceById(id)
		if (!source) return undefined
		const column = new Column(source, () => this.onSettled())
		this.columns.set(id, column)
		this.viewObserver.observe(column.el)
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
	}

	/** Applies the current source to whichever layout is active. */
	private applyLayout(): void {
		for (const [id, column] of this.columns) {
			column.el.classList.toggle('is-current', id === this.current)
		}
		const column = this.current ? this.columns.get(this.current) : undefined
		if (WIDE.matches) {
			// The page does not scroll in this layout. Clear an offset left over from the phone layout.
			scrollTo({ behavior: 'instant', top: 0 })
			// The observer fills `visible` again once the columns are laid out.
			if (column) this.options.deck.scrollTo({ behavior: 'instant', left: column.el.offsetLeft })
		} else {
			this.visible.clear()
			if (this.current) this.visible.add(this.current)
			void column?.activate()
		}
		this.markTabs()
	}

	private onTabClick(event: MouseEvent): void {
		const tab = (event.target as Element).closest<HTMLElement>('.tab')
		const id = tab?.dataset.id
		if (!id || event.metaKey || event.ctrlKey || event.shiftKey) return
		event.preventDefault()
		// Tapping the tab of a source that is already in view scrolls it to the top.
		if (this.visible.has(id)) this.scrollToTop(id)
		else this.show(id, scrollBehavior())
		this.writeHash(id)
	}

	private scrollToTop(id: string): void {
		if (WIDE.matches) this.columns.get(id)?.scrollToTop()
		else scrollTo({ behavior: scrollBehavior(), top: 0 })
	}

	private show(id: string, behavior: ScrollBehavior): void {
		const column = this.columns.get(id)
		if (!column) return
		if (WIDE.matches) {
			this.options.deck.scrollTo({ behavior, left: column.el.offsetLeft })
			return
		}
		if (this.current) this.scrollTops.set(this.current, scrollY)
		this.current = id
		this.applyLayout()
		scrollTo({ behavior: 'instant', top: this.scrollTops.get(id) ?? 0 })
	}

	/** Wide screens only. Tracks which columns are in view and loads them. */
	private onView(entries: IntersectionObserverEntry[]): void {
		if (!WIDE.matches) return
		for (const entry of entries) {
			const id = entry.target.id.replace('source-', '')
			if (!entry.isIntersecting) {
				this.visible.delete(id)
				continue
			}
			this.visible.add(id)
			void this.columns.get(id)?.activate()
		}
		this.current = this.order.find((id) => this.visible.has(id)) ?? this.current
		this.markTabs()
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
		const start = tab.offsetLeft - 12
		const end = tab.offsetLeft + tab.offsetWidth + 12
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

	/** Sources that are not in view, nearest to the current one first. */
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
	 * Fetches the sources that are not in view, one at a time, so they are ready
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
