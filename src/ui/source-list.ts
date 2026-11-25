import type { SourceSetting } from '../settings'
import { sourceById } from '../sources/index'
import type { SourceMeta } from '../sources/types'
import { el, icon, popBadge } from './dom'
import { enableReorder } from './reorder'

interface SourceListOptions {
	scroller: HTMLElement
	onChange: (sources: SourceSetting[]) => void
	refresh?: () => void
	onActive?: (id: string | null) => void
}

export interface SourceList {
	nodes: [HTMLUListElement, HTMLElement]
	render(sources: readonly SourceSetting[]): void
	read(): SourceSetting[]
}

function describe(source: SourceMeta): string {
	const marks = source.comments ? ['comments', source.fetch] : [source.fetch]
	return `${source.tagline} · ${marks.join(' · ')}`
}

function renderRow(source: SourceMeta, enabled: boolean): HTMLLIElement {
	const row = el('li', 'src')
	row.dataset.id = source.id

	const main = el('label', 'src-main')
	const check = el('input', 'check')
	check.type = 'checkbox'
	check.checked = enabled
	const badge = el('span', 'badge', source.mark)
	badge.style.setProperty('--badge-bg', source.badge[0])
	badge.style.setProperty('--badge-fg', source.badge[1])
	const text = el('span', 'src-text')
	text.append(el('span', 'src-name', source.name), el('span', 'src-tag', describe(source)))
	main.append(check, badge, text)

	const handle = el('button', 'handle')
	handle.type = 'button'
	handle.setAttribute('aria-label', `Reorder ${source.name}. Drag, or use the arrow keys.`)
	handle.append(icon('grip'))

	row.append(main, handle)
	return row
}

export function createSourceList(options: SourceListOptions): SourceList {
	const list = el('ul', 'src-list')
	const live = el('p', 'visually-hidden')
	live.setAttribute('aria-live', 'polite')
	let pendingRefresh = false

	const rowsOf = (): HTMLElement[] =>
		(Array.from(list.children) as HTMLElement[]).filter((child) => child.tagName === 'LI')

	const read = (): SourceSetting[] =>
		rowsOf().map((row) => ({
			enabled: row.querySelector<HTMLInputElement>('.check')?.checked === true,
			id: row.dataset.id ?? '',
		}))

	const announce = (row: HTMLElement): void => {
		const rows = rowsOf()
		const position = rows.indexOf(row) + 1
		const name = row.querySelector('.src-name')?.textContent ?? ''
		live.textContent = `${name}, position ${position} of ${rows.length}`
	}

	list.addEventListener('change', (event) => {
		const row = (event.target as Element).closest<HTMLElement>('.src')
		if (row) popBadge(row)
		options.onChange(read())
	})
	list.addEventListener('animationend', (event) => {
		const row = (event.target as Element).closest<HTMLElement>('.src')
		row?.classList.remove('is-tapped')
	})
	enableReorder(list, {
		onChange: () => options.onChange(read()),
		onMove: (row) => {
			announce(row)
			options.onActive?.(row.dataset.id ?? null)
		},
		scroller: options.scroller,
		onActive: (id) => options.onActive?.(id),
		onSortEnd: () => {
			options.onActive?.(null)
			if (!pendingRefresh) return
			pendingRefresh = false
			options.refresh?.()
		},
	})

	return {
		nodes: [list, live],
		read,
		render(sources) {
			if (list.classList.contains('is-sorting')) {
				pendingRefresh = true
				return
			}
			const rows = sources.flatMap((setting) => {
				const source = sourceById(setting.id)
				return source ? [renderRow(source, setting.enabled)] : []
			})
			list.replaceChildren(...rows)
		},
	}
}
