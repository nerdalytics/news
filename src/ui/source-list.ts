import type { SourceSetting } from '../settings'
import { sourceById } from '../sources/index'
import type { SourceMeta } from '../sources/types'
import { el, icon, popBadge } from './dom'
import { enableReorder } from './reorder'

interface SourceListOptions {
	scroller: HTMLElement
	onChange: (sources: SourceSetting[]) => void
	refresh?: () => void
}

export interface SourceList {
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

export function createSourceList(options: SourceListOptions): SourceList {
	const list = el('ul', 'src-list')
	const live = el('p', 'visually-hidden')
	live.setAttribute('aria-live', 'polite')
	let pendingRefresh = false

	const flow = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
	flow.setAttribute('class', 'flow')
	flow.setAttribute('aria-hidden', 'true')
	const flowPath = document.createElementNS('http://www.w3.org/2000/svg', 'path')
	flow.append(flowPath)

	const drawFlow = (): void => {
		const rows = Array.from(list.children).filter((row) => row !== flow) as HTMLElement[]
		flow.setAttribute('viewBox', `0 0 ${list.clientWidth} ${list.clientHeight}`)
		if (rows.length < 2) {
			flowPath.setAttribute('d', '')
			return
		}
		flowPath.setAttribute(
			'd',
			rows
				.map(
					(row, i) =>
						`${i === 0 ? 'M' : 'L'}${row.offsetLeft + row.offsetWidth / 2} ${
							row.offsetTop + row.offsetHeight / 2
						}`
				)
				.join(' ')
		)
	}
	let drawFrame = 0
	const scheduleDraw = (): void => {
		cancelAnimationFrame(drawFrame)
		drawFrame = requestAnimationFrame(drawFlow)
	}
	if (typeof ResizeObserver !== 'undefined') new ResizeObserver(scheduleDraw).observe(list)

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
			scheduleDraw()
		},
		scroller: options.scroller,
		onSortEnd: () => {
			scheduleDraw()
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
			list.replaceChildren(flow, ...rows)
			scheduleDraw()
		},
	}
}
