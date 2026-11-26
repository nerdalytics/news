import { hide } from '../hidden'
import { markRead, markUnread } from '../read'
import { getSettings, isBlocked, isFavorite, setBlocked, setFavorite } from '../settings'
import { sourceById } from '../sources/index'
import { HEAT, recordHeat, recordRead } from '../temperature'
import { Column } from './column'
import { el, popBadge, prefersReducedMotion, slideView, whenIdle } from './dom'
import { navDirection, SWIPE_LABELS, type SwipeAction } from './gestures'
import { capacity, topsChanged, windowStart, windowStep } from './layout'
import { openInBrowser } from './open'

interface DeckOptions {
	deck: HTMLElement
	tabs: HTMLElement
	onFirstSettled: () => void
	onManage: (sourceId?: string) => void
	onSite: (site: string) => void
	onJump: () => void
}

const COLUMN_MIN = '--column-min'
const TAB_MARGIN_PX = 12

function savesData(): boolean {
	const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
	return connection?.saveData === true
}

function scrollBehavior(): ScrollBehavior {
	return prefersReducedMotion() ? 'instant' : 'smooth'
}

export class Deck {
	private readonly columns = new Map<string, Column>()
	private readonly tabs = new Map<string, HTMLAnchorElement>()
	private visible = new Set<string>()
	private readonly scrollTops = new Map<string, number>()
	private readonly scrollDistance = new Map<string, number>()
	private lastScrollY = 0
	private readonly lastSeenTop = new Map<string, string>()
	private order: string[] = []
	private current: string | undefined
	private size = 1
	private settled = false
	private prefetching = false
	private prefetchAgain = false
	private wasHidden = false

	constructor(private readonly options: DeckOptions) {
		new ResizeObserver(() => this.onResize()).observe(options.deck)
		options.tabs.addEventListener('click', (event) => this.onTabClick(event))
		options.deck.addEventListener('click', (event) => this.onItemClick(event))
		options.deck.addEventListener('auxclick', (event) => this.onItemClick(event))
		addEventListener('hashchange', () => this.showFromHash())
		addEventListener('scroll', () => this.onScroll())
		document.addEventListener('visibilitychange', () => {
			if (document.visibilityState === 'hidden') this.wasHidden = true
			else this.onResume()
		})
		addEventListener('pageshow', (event) => {
			if (event.persisted) {
				this.wasHidden = true
				this.onResume()
			}
		})
	}

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

	restyle(): void {
		for (const column of this.columns.values()) column.restyle()
	}

	refresh(element: HTMLElement): Promise<void> {
		const id = element.id.replace('source-', '')
		return this.columns.get(id)?.refresh() ?? Promise.resolve()
	}

	swipeApplies(row: HTMLElement, action: SwipeAction): boolean {
		if (action === 'next' || action === 'previous') return this.order.length > this.size
		if (action === 'block' || action === 'favorite') return row.dataset.site !== undefined
		if (action === 'comments') return row.querySelector('a.comments') !== null
		return row.dataset.url !== undefined
	}

	swipeLabel(row: HTMLElement, action: SwipeAction): string {
		const site = row.dataset.site
		if (action === 'block' && site) return isBlocked(site) ? 'Unblock' : 'Block'
		if (action === 'favorite' && site) return isFavorite(site) ? 'Unfavorite' : 'Favorite'
		return SWIPE_LABELS[action]
	}

	swipe(row: HTMLElement, action: SwipeAction): void {
		if (action === 'next' || action === 'previous') {
			this.step(action === 'next' ? 1 : -1)
			return
		}
		const { site, url } = row.dataset
		if (!url) return
		const comments = row.querySelector<HTMLAnchorElement>('a.comments')?.href
		const sourceId = row.closest<HTMLElement>('[id^="source-"]')?.id.replace('source-', '')
		this.rowAction(action, url, site, comments, sourceId)
		this.restyle()
	}

	private rowAction(
		action: SwipeAction,
		url: string,
		site: string | undefined,
		comments: string | undefined,
		sourceId: string | undefined
	): void {
		const heat = (amount: number): void => {
			if (sourceId) recordHeat(sourceId, amount)
		}
		const actions: Partial<Record<SwipeAction, () => void>> = {
			read: () => {
				markRead(url)
				heat(HEAT.read)
			},
			unread: () => markUnread(url),
			hide: () => {
				hide(url)
				heat(HEAT.hide)
			},
			block: () => {
				if (site) {
					setBlocked(site, !isBlocked(site))
					heat(isBlocked(site) ? HEAT.block : -HEAT.block)
				}
			},
			favorite: () => {
				if (site) {
					setFavorite(site, !isFavorite(site))
					heat(isFavorite(site) ? HEAT.favorite : -HEAT.favorite)
				}
			},
			comments: () => {
				if (comments) {
					this.navigate(comments)
					heat(HEAT.read)
				}
			},
			browser: () => {
				openInBrowser(url)
				heat(HEAT.read)
			},
		}
		actions[action]?.()
	}

	private step(delta: 1 | -1): void {
		const count = this.order.length
		if (count < 2) return
		const index = this.current ? this.order.indexOf(this.current) : 0
		const target = this.order[windowStep(index, count, this.size, delta)]
		if (!target) return
		this.show(target)
		this.writeHash(target)
	}

	private onScroll(): void {
		const id = this.current
		const column = id ? this.columns.get(id) : undefined
		if (!id || !column) return
		const y = scrollY
		const delta = Math.abs(y - this.lastScrollY)
		this.lastScrollY = y
		if (delta === 0) return
		const height = column.el.scrollHeight
		if (height <= 0) return
		const distance = (this.scrollDistance.get(id) ?? 0) + delta
		this.scrollDistance.set(id, distance)
		const span = 2 * height
		const rise =
			(Math.min(1, distance / span) - Math.min(1, (distance - delta) / span)) * HEAT.scrollFull
		if (rise > 0) recordHeat(id, rise)
	}

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
		const link = target.closest<HTMLAnchorElement>('a.title, a.comments')
		if (!link || event.button > 1) return
		const sourceId = target.closest<HTMLElement>('[id^="source-"]')?.id.replace('source-', '')
		if (sourceId) recordRead(sourceId)
		if (link.classList.contains('title')) {
			markRead(link.href)
			this.restyle()
		}
	}

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
		const column = new Column(
			source,
			() => this.onSettled(),
			(id) => this.options.onManage(id)
		)
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

	private measure(): number {
		const deck = this.options.deck
		const value = getComputedStyle(deck).getPropertyValue(COLUMN_MIN)
		const columnMin = value.endsWith('px') ? Number.parseFloat(value) : Number.NaN
		return capacity(deck.getBoundingClientRect().width, columnMin)
	}

	private onResize(): void {
		const size = this.measure()
		if (size === this.size) return
		this.size = size
		this.applyLayout()
	}

	private window(): string[] {
		const index = this.current ? this.order.indexOf(this.current) : 0
		const start = windowStart(index, this.order.length, this.size)
		return this.order.slice(start, start + this.size)
	}

	private applyLayout(): void {
		this.visible = new Set(this.window())
		this.options.tabs.classList.toggle('is-multi', this.visible.size > 1)
		for (const [id, column] of this.columns) {
			const visible = this.visible.has(id)
			column.el.hidden = !visible
			column.setVisible(visible)
			if (visible) void column.activate()
		}
		this.markTabs()
	}

	private onTabClick(event: MouseEvent): void {
		const tab = (event.target as Element).closest<HTMLElement>('.tab')
		const id = tab?.dataset.id
		if (!id || event.metaKey || event.ctrlKey || event.shiftKey) return
		event.preventDefault()
		if (tab) popBadge(tab)
		if (this.visible.has(id)) scrollTo({ behavior: scrollBehavior(), top: 0 })
		else this.show(id, true)
		this.writeHash(id)
	}

	private show(id: string, animate = false): void {
		if (!this.columns.has(id)) return
		const from = this.current ? this.order.indexOf(this.current) : 0
		const to = this.order.indexOf(id)
		const update = (): void => {
			const previous = this.window()[0]
			if (previous) {
				this.scrollTops.set(previous, scrollY)
				if ((this.scrollDistance.get(previous) ?? 0) === 0) recordHeat(previous, HEAT.swipePast)
				this.scrollDistance.delete(previous)
			}
			this.current = id
			this.applyLayout()
			const first = this.window()[0]
			const top = this.columns.get(id)?.topItemId()
			const seen = this.lastSeenTop.get(id)
			const target = topsChanged(top, seen) ? 0 : (first && this.scrollTops.get(first)) || 0
			this.lastScrollY = target
			this.scrollDistance.delete(id)
			scrollTo({ behavior: 'instant', top: target })
			if (top !== undefined) this.lastSeenTop.set(id, top)
			this.options.onJump()
		}
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

	private revealTab(tab: HTMLElement): void {
		const strip = this.options.tabs
		const start = tab.offsetLeft - TAB_MARGIN_PX
		const end = tab.offsetLeft + tab.offsetWidth + TAB_MARGIN_PX
		if (start < strip.scrollLeft) strip.scrollTo({ left: start })
		else if (end > strip.scrollLeft + strip.clientWidth) {
			strip.scrollTo({ left: end - strip.clientWidth })
		}
	}

	private writeHash(id: string): void {
		if (location.hash.slice(1) !== id) history.replaceState(null, '', `#${id}`)
	}

	private onSettled(): void {
		if (this.settled) return
		this.settled = true
		this.options.onFirstSettled()
		whenIdle(() => this.prefetchOthers())
	}

	private othersByDistance(): string[] {
		const origin = this.current ? this.order.indexOf(this.current) : 0
		return this.order
			.filter((id) => !this.visible.has(id))
			.sort(
				(a, b) =>
					Math.abs(this.order.indexOf(a) - origin) - Math.abs(this.order.indexOf(b) - origin)
			)
	}

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

	private onResume(): void {
		if (document.visibilityState !== 'visible') return
		const returning = this.wasHidden
		this.wasHidden = false
		for (const id of this.visible) {
			const column = this.columns.get(id)
			if (returning) column?.endVisit()
			void column?.activate()
		}
		void this.prefetchOthers()
	}
}
