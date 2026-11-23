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

interface Pt {
	x: number
	y: number
}

function rounded(pts: Pt[], r: number): string {
	if (pts.length < 2) return ''
	let d = `M${pts[0]!.x} ${pts[0]!.y}`
	for (let i = 1; i < pts.length - 1; i++) {
		const p = pts[i]!
		const prev = pts[i - 1]!
		const next = pts[i + 1]!
		const inLen = Math.hypot(p.x - prev.x, p.y - prev.y)
		const outLen = Math.hypot(next.x - p.x, next.y - p.y)
		if (inLen === 0 || outLen === 0) continue
		const ri = Math.min(r, inLen / 2, outLen / 2)
		d += `L${p.x - ((p.x - prev.x) / inLen) * ri} ${p.y - ((p.y - prev.y) / inLen) * ri}`
		d += `Q${p.x} ${p.y} ${p.x + ((next.x - p.x) / outLen) * ri} ${
			p.y + ((next.y - p.y) / outLen) * ri
		}`
	}
	const last = pts[pts.length - 1]!
	return `${d}L${last.x} ${last.y}`
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
		const w = list.clientWidth
		flow.setAttribute('viewBox', `0 0 ${w} ${list.clientHeight}`)
		const gap = Number.parseFloat(getComputedStyle(list).columnGap) || 0
		const rowGap = Number.parseFloat(getComputedStyle(list).rowGap) || 0
		const wrapped = rows.some((row, i) => i > 0 && row.offsetTop === rows[i - 1]!.offsetTop)
		if (!wrapped || rows.length < 2) {
			flowPath.setAttribute('d', '')
			return
		}
		const outer = gap / 2
		const radius = rowGap / 2
		const parts: string[] = []
		for (let i = 0; i < rows.length - 1; i++) {
			const a = rows[i]!
			const b = rows[i + 1]!
			const aMid = a.offsetTop + a.offsetHeight / 2
			const bMid = b.offsetTop + b.offsetHeight / 2
			const aRight = a.offsetLeft + a.offsetWidth
			const tip = b.offsetLeft - radius
			const lineEnd = tip - radius
			if (a.offsetTop === b.offsetTop) {
				parts.push(
					rounded(
						[
							{ x: aRight, y: aMid },
							{ x: lineEnd, y: bMid },
						],
						radius
					)
				)
			} else {
				const gapY = a.offsetTop + a.offsetHeight + rowGap / 2
				parts.push(
					rounded(
						[
							{ x: aRight, y: aMid },
							{ x: w + outer, y: aMid },
							{ x: w + outer, y: gapY },
							{ x: -outer, y: gapY },
							{ x: -outer, y: bMid },
							{ x: lineEnd, y: bMid },
						],
						radius
					)
				)
			}
			parts.push(`M${lineEnd} ${bMid - radius / 2}L${tip} ${bMid}L${lineEnd} ${bMid + radius / 2}`)
		}
		flowPath.setAttribute('d', parts.join(''))
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
