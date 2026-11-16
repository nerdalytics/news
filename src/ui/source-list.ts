import type { SourceSetting } from '../settings'
import { sourceById } from '../sources/index'
import type { SourceMeta } from '../sources/types'
import { el, icon } from './dom'
import { enableReorder } from './reorder'

interface SourceListOptions {
	/** The element that scrolls when the list is taller than the screen. */
	scroller: HTMLElement
	/** Called after the reader toggled a source or changed the order. */
	onChange: (sources: SourceSetting[]) => void
}

export interface SourceList {
	/** The list element and a live region that announces moves to screen readers. */
	nodes: [HTMLUListElement, HTMLElement]
	render(sources: readonly SourceSetting[]): void
	read(): SourceSetting[]
}

function describe(source: SourceMeta): string {
	return source.comments ? `${source.tagline} · comments` : source.tagline
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

/** The list of all sources with a checkbox and a drag handle per row. */
export function createSourceList(options: SourceListOptions): SourceList {
	const list = el('ul', 'src-list')
	const live = el('p', 'visually-hidden')
	live.setAttribute('aria-live', 'polite')

	const read = (): SourceSetting[] =>
		(Array.from(list.children) as HTMLElement[]).map((row) => ({
			enabled: row.querySelector<HTMLInputElement>('.check')?.checked === true,
			id: row.dataset.id ?? '',
		}))

	const announce = (row: HTMLElement): void => {
		const position = Array.from(list.children).indexOf(row) + 1
		const name = row.querySelector('.src-name')?.textContent ?? ''
		live.textContent = `${name}, position ${position} of ${list.children.length}`
	}

	list.addEventListener('change', () => options.onChange(read()))
	enableReorder(list, {
		onChange: () => options.onChange(read()),
		onMove: announce,
		scroller: options.scroller,
	})

	return {
		nodes: [list, live],
		read,
		render(sources) {
			const rows = sources.flatMap((setting) => {
				const source = sourceById(setting.id)
				return source ? [renderRow(source, setting.enabled)] : []
			})
			list.replaceChildren(...rows)
		},
	}
}
