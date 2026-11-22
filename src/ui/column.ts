import { generatedAt } from '../availability'
import { type Feed, isFresh, peek, refresh } from '../cache'
import { count, hostOf, timeAgo } from '../format'
import { isHidden } from '../hidden'
import { describeError } from '../net'
import { isRead } from '../read'
import { getSettings, isBlocked, isFavorite } from '../settings'
import type { FeedItem, SourceMeta } from '../sources/types'
import { el, icon } from './dom'

const SKELETON_ROWS = 8

function externalLink(className: string, href: string, text: string): HTMLAnchorElement {
	const link = el('a', className, text)
	link.href = href
	link.rel = 'noopener'
	if (getSettings().newTab) link.target = '_blank'
	return link
}

function timeElement(time: number): HTMLTimeElement {
	const node = el('time', undefined, timeAgo(time))
	node.dateTime = new Date(time).toISOString()
	return node
}

export function siteOf(item: FeedItem, source: SourceMeta): string | undefined {
	const host = hostOf(item.url)
	return host === hostOf(source.home) ? undefined : host
}

function siteButton(site: string, label: string): HTMLButtonElement {
	const button = el('button', 'site', label)
	button.type = 'button'
	button.dataset.site = site
	button.setAttribute('aria-haspopup', 'dialog')
	button.setAttribute('aria-label', `${label}, options for ${site}`)
	return button
}

function tagOf(item: FeedItem, source: SourceMeta): Node | string | undefined {
	const site = siteOf(item, source)
	return site ? siteButton(site, item.tag ?? site) : item.tag
}

function metaParts(item: FeedItem, source: SourceMeta): Array<Node | string> {
	const parts: Array<Node | string> = []
	if (item.score) parts.push(count(item.score.value, item.score.label))
	if (item.comments) {
		const label = count(item.comments.count, item.comments.label)
		parts.push(externalLink('comments', item.comments.url, label))
	}
	if (item.time) parts.push(timeElement(item.time))
	const tag = tagOf(item, source)
	if (tag) parts.push(tag)
	return parts
}

function renderMeta(item: FeedItem, source: SourceMeta): HTMLElement {
	const meta = el('div', 'meta')
	for (const part of metaParts(item, source)) {
		if (meta.childNodes.length > 0) meta.append(el('span', 'dot', '·'))
		meta.append(typeof part === 'string' ? el('span', undefined, part) : part)
	}
	return meta
}

function applyState(row: HTMLElement): void {
	const { site, url } = row.dataset
	row.hidden = url !== undefined && isHidden(url)
	row.classList.toggle('is-read', url !== undefined && isRead(url))
	row.classList.toggle('is-blocked', site !== undefined && isBlocked(site))
	row.classList.toggle('is-favorite', site !== undefined && isFavorite(site))
}

function renderItem(item: FeedItem, index: number, source: SourceMeta): HTMLLIElement {
	const row = el('li', 'item')
	row.dataset.url = item.url
	row.style.setProperty('--i', String(index))
	const site = siteOf(item, source)
	if (site) row.dataset.site = site
	applyState(row)
	const content = el('div', 'item-body')
	content.append(externalLink('title', item.url, item.title))
	if (item.description) content.append(el('p', 'desc', item.description))
	content.append(renderMeta(item, source))
	row.append(el('span', 'rank', String(item.rank ?? index + 1)), content)
	return row
}

function renderSkeleton(): HTMLOListElement {
	const list = el('ol', 'list skeleton')
	list.setAttribute('aria-hidden', 'true')
	for (let index = 0; index < SKELETON_ROWS; index++) {
		const row = el('li', 'item')
		const content = el('div', 'item-body')
		content.append(el('span', 'bone bone-title'), el('span', 'bone bone-meta'))
		row.append(el('span', 'bone bone-rank'), content)
		list.append(row)
	}
	return list
}

function updatedLabel(fetchedAt: number): string {
	const age = timeAgo(fetchedAt)
	return age === 'now' ? 'Updated just now' : `Updated ${age} ago`
}

export class Column {
	readonly el: HTMLElement
	private readonly body: HTMLElement
	private readonly foot: HTMLElement
	private pending: Promise<void> | undefined
	private shown: Feed | undefined

	constructor(
		readonly source: SourceMeta,
		private readonly onSettled: () => void,
		private readonly onSettings: (id: string) => void
	) {
		this.el = el('section', 'column')
		this.el.id = `source-${source.id}`
		this.el.style.setProperty('--brand-light', source.accent[0])
		this.el.style.setProperty('--brand-dark', source.accent[1])
		this.body = el('div', 'col-body')
		this.foot = el('footer', 'col-foot')
		this.el.append(this.renderHead(), this.body, this.foot)
		this.el.setAttribute('aria-labelledby', `title-${source.id}`)
		const cached = peek(source.id)
		if (cached) this.render(cached)
	}

	activate(): Promise<void> {
		return this.revalidate('high')
	}

	refresh(): Promise<void> {
		return this.load('high')
	}

	prefetch(): Promise<void> {
		return this.revalidate('low')
	}

	restyle(): void {
		for (const row of this.el.querySelectorAll<HTMLElement>('.item[data-url]')) applyState(row)
	}

	topItemId(): string | undefined {
		return this.shown?.items[0]?.id
	}

	setNewTab(newTab: boolean): void {
		for (const link of this.el.querySelectorAll<HTMLAnchorElement>('.list a')) {
			link.target = newTab ? '_blank' : ''
		}
	}

	private renderHead(): HTMLElement {
		const head = el('header', 'col-head')
		const titles = el('div')
		const title = el('h2', 'col-title', this.source.name)
		title.id = `title-${this.source.id}`
		titles.append(title, el('p', 'col-tagline', this.source.tagline))
		const settings = el('button', 'icon-btn col-settings')
		settings.type = 'button'
		settings.setAttribute('aria-label', `Settings for ${this.source.name}`)
		settings.append(icon('sliders'))
		settings.addEventListener('click', () => this.onSettings(this.source.id))
		head.append(titles, settings)
		return head
	}

	private revalidate(priority: RequestPriority): Promise<void> {
		const cached = peek(this.source.id)
		if (cached && cached !== this.shown) this.render(cached)
		else if (this.shown) this.renderFoot()
		if (cached && isFresh(cached, this.source)) return Promise.resolve()
		return this.load(priority)
	}

	private load(priority: RequestPriority): Promise<void> {
		this.pending ??= this.fetch(priority).finally(() => {
			this.pending = undefined
		})
		return this.pending
	}

	private async fetch(priority: RequestPriority): Promise<void> {
		this.el.dataset.state = 'loading'
		if (!this.shown) this.body.replaceChildren(renderSkeleton())
		try {
			this.render(await refresh(this.source, priority))
		} catch (error) {
			this.renderError(describeError(error))
		} finally {
			this.onSettled()
		}
	}

	private render(feed: Feed): void {
		const entering = this.shown === undefined
		this.shown = feed
		this.el.dataset.state = 'ready'
		if (feed.items.length === 0) {
			this.body.replaceChildren(el('p', 'notice', 'This source returned no entries.'))
		} else {
			const list = el('ol', 'list')
			if (entering) list.classList.add('is-new')
			list.append(...feed.items.map((item, index) => renderItem(item, index, this.source)))
			this.body.replaceChildren(list)
		}
		this.renderFoot()
		this.onSettled()
	}

	private retryButton(): HTMLButtonElement {
		const retry = el('button', 'link-btn', 'Try again')
		retry.type = 'button'
		retry.addEventListener('click', () => void this.load('high'))
		return retry
	}

	private renderFoot(problem?: string): void {
		if (!this.shown) {
			this.foot.replaceChildren()
			return
		}
		const updated = updatedLabel(generatedAt(this.source.id) ?? this.shown.fetchedAt)
		const home = el('a', undefined, hostOf(this.source.home))
		home.href = this.source.home
		home.rel = 'noopener'
		this.foot.replaceChildren(el('span', undefined, updated), el('span', 'dot', '·'), home)
		if (!problem) return
		const warning = el('p', 'foot-problem', `Could not refresh. ${problem} `)
		warning.setAttribute('role', 'status')
		warning.append(this.retryButton())
		this.foot.prepend(warning)
	}

	private renderError(message: string): void {
		this.el.dataset.state = 'error'
		if (this.shown) {
			this.renderFoot(message)
			return
		}
		const notice = el('div', 'notice')
		notice.setAttribute('role', 'status')
		notice.append(el('p', undefined, message), this.retryButton())
		this.body.replaceChildren(notice)
	}
}
