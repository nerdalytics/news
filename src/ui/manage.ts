import { isAvailable, onAvailabilityChange } from '../availability'
import { hiddenCount, showAllHidden } from '../hidden'
import { checkHosted } from '../hosted-check'
import {
	DESC_MAX,
	getSettings,
	type SourceSetting,
	type Theme,
	updateSettings,
	withHiddenSources,
} from '../settings'
import { sourceById } from '../sources/index'
import { HEAT, recordHeat, temperature, WINDOW_LABELS, WINDOWS, type Window } from '../temperature'
import { el, enableOutsideDismiss } from './dom'
import { SWIPE_ACTIONS, SWIPE_DESCRIPTIONS, type SwipeSlot } from './gestures'
import { createSourceList, type SourceList } from './source-list'

const THEMES: ReadonlyArray<readonly [value: Theme, label: string]> = [
	['auto', 'Auto'],
	['light', 'Light'],
	['dark', 'Dark'],
]

let dialog: HTMLDialogElement | undefined
let sources: SourceList | undefined
let activeWindow: Window = 'day'

function renderThemePicker(): HTMLElement {
	const group = el('fieldset', 'pref')
	group.append(el('legend', undefined, 'Appearance'))
	const options = el('div', 'segmented')
	for (const [value, label] of THEMES) {
		const option = el('label')
		const radio = el('input')
		radio.type = 'radio'
		radio.name = 'theme'
		radio.value = value
		radio.checked = getSettings().theme === value
		radio.addEventListener('change', () => updateSettings({ theme: value }))
		option.append(radio, el('span', undefined, label))
		options.append(option)
	}
	group.append(options)
	return group
}

function renderSwitch(
	label: string,
	checked: boolean,
	onChange: (checked: boolean) => void
): HTMLElement {
	const row = el('label', 'switch-row')
	const toggle = el('input', 'switch')
	toggle.type = 'checkbox'
	toggle.setAttribute('role', 'switch')
	toggle.checked = checked
	toggle.addEventListener('change', () => onChange(toggle.checked))
	row.append(el('span', undefined, label), toggle)
	return row
}

function renderNewTabSwitch(): HTMLElement {
	const section = el('section', 'pref')
	section.append(
		renderSwitch('Open links in a new tab', getSettings().newTab, (newTab) =>
			updateSettings({ newTab })
		)
	)
	return section
}

const SLOT_LABELS: ReadonlyArray<readonly [slot: SwipeSlot, label: string]> = [
	['left', 'Short swipe left'],
	['right', 'Short swipe right'],
	['leftLong', 'Long swipe left'],
	['rightLong', 'Long swipe right'],
]

const NO_ACTION = ''

function renderSwipeSelect(slot: SwipeSlot, label: string): HTMLElement {
	const row = el('label', 'select-row')
	const select = el('select', 'select')
	select.append(new Option('Nothing', NO_ACTION))
	for (const action of SWIPE_ACTIONS) select.append(new Option(SWIPE_DESCRIPTIONS[action], action))
	select.value = getSettings().swipe[slot] ?? NO_ACTION
	select.addEventListener('change', () => {
		const swipe = { ...getSettings().swipe }
		const action = SWIPE_ACTIONS.find((known) => known === select.value)
		if (action) swipe[slot] = action
		else delete swipe[slot]
		updateSettings({ swipe })
	})
	row.append(el('span', undefined, label), select)
	return row
}

function renderHiddenEntries(): HTMLElement {
	const row = el('p', 'hidden-entries')
	const render = (): void => {
		const count = hiddenCount()
		row.replaceChildren(count === 1 ? '1 hidden entry. ' : `${count} hidden entries. `)
		if (count === 0) return
		const button = el('button', 'link-btn', 'Show them again')
		button.type = 'button'
		button.addEventListener('click', () => {
			showAllHidden()
			updateSettings({})
			render()
		})
		row.append(button)
	}
	render()
	return row
}

function renderSwipeSettings(): HTMLElement {
	const section = el('section', 'pref pref-swipe')
	const grid = el('div', 'swipe-grid')
	grid.append(...SLOT_LABELS.map(([slot, label]) => renderSwipeSelect(slot, label)))
	section.append(el('h3', undefined, 'Swipe gestures'), grid, renderHiddenEntries())
	return section
}

function descLabel(lines: number): string {
	if (lines <= 0) return 'Off'
	if (lines >= DESC_MAX) return 'Max'
	return lines === 1 ? '1 line' : `${lines} lines`
}

function renderDescSlider(): HTMLElement {
	const row = el('label', 'select-row slider-row')
	const input = el('input', 'range')
	input.type = 'range'
	input.min = '0'
	input.max = String(DESC_MAX)
	input.step = '1'
	input.value = String(getSettings().descLines)
	const value = el('span', 'slider-value', descLabel(getSettings().descLines))
	input.addEventListener('input', () => {
		const lines = Number(input.value)
		value.textContent = descLabel(lines)
		updateSettings({ descLines: lines })
	})
	row.append(el('span', undefined, 'Description length'), input, value)
	return row
}

function renderEntries(): HTMLElement {
	const section = el('section', 'pref')
	section.append(
		el('h3', undefined, 'Entries'),
		renderDescSlider(),
		renderSwitch('Show status row', getSettings().showStatus, (showStatus) =>
			updateSettings({ showStatus })
		)
	)
	return section
}

function listedSources(): SourceSetting[] {
	return getSettings().sources.filter((setting) => {
		const source = sourceById(setting.id)
		return source !== undefined && isAvailable(source)
	})
}

const CONFIRM_WINDOW_MS = 5000
const MS_PER_S = 1000
const RESET_LABEL = 'Start fresh'
const CONFIRM_LABEL = 'Tap again to delete everything'

function renderReset(): HTMLElement {
	const section = el('section', 'pref')
	const button = el('button', 'warning-btn', RESET_LABEL)
	button.type = 'button'
	let armed = false
	let timer = 0
	const disarm = (): void => {
		armed = false
		button.textContent = RESET_LABEL
	}
	button.addEventListener('click', async () => {
		if (armed) {
			clearTimeout(timer)
			const { startFresh } = await import('../reset')
			await startFresh()
			return
		}
		armed = true
		button.textContent = CONFIRM_LABEL
		timer = window.setTimeout(disarm, CONFIRM_WINDOW_MS)
	})
	section.append(
		el('h3', undefined, 'Start fresh'),
		el(
			'p',
			undefined,
			'TheNews saves everything in this browser, in cookies and local storage; it has no accounts and no server of its own. Start fresh deletes your sources, blocked sites, opened links and cached feeds, then shows the first-run screen.'
		),
		button
	)
	return section
}

let preview: HTMLElement | null = null
let previewWrap: HTMLElement | null = null
let activeId: string | null = null
let tailWatch: ResizeObserver | undefined

function measureTail(): void {
	const list = previewWrap?.nextElementSibling
	const scope = list?.closest<HTMLElement>('.sheet-body')
	if (!list || !scope) return
	const rows = (Array.from(list.children) as HTMLElement[]).filter(
		(child) => child.tagName === 'LI'
	)
	const tail = rows.slice(-2)
	const gap = tail.length === 2 ? Number.parseFloat(getComputedStyle(list).rowGap) : 0
	const height = tail.reduce((sum, row) => sum + row.offsetHeight, 0) + gap
	scope.style.setProperty('--tail-h', `${height}px`)
}

function renderPreview(): void {
	if (!preview) return
	const badges = (sources?.read() ?? [])
		.filter((setting) => setting.enabled)
		.map((setting) => {
			const source = sourceById(setting.id)
			if (!source) return null
			const badge = el('span', 'badge preview-badge', source.mark)
			badge.style.setProperty('--badge-bg', source.badge[0])
			badge.style.setProperty('--badge-fg', source.badge[1])
			badge.dataset.id = source.id
			if (source.id === activeId) badge.classList.add('is-active')
			return badge
		})
		.filter((badge): badge is HTMLElement => badge !== null)
	preview.replaceChildren(...badges)
	const active = preview.querySelector<HTMLElement>('.is-active')
	if (active)
		preview.scrollLeft = active.offsetLeft - (preview.clientWidth - active.offsetWidth) / 2
}

function renderTemperatureBar(): HTMLElement {
	const bar = el('div', 'temp-bar')
	const select = el('select', 'select temp-window')
	for (const window of WINDOWS) select.append(new Option(WINDOW_LABELS[window], window))
	select.value = activeWindow
	select.addEventListener('change', () => {
		activeWindow = select.value as Window
		sources?.render(listedSources(), activeWindow)
	})
	const sort = el('button', 'link-btn temp-sort', 'Sort by temperature')
	sort.type = 'button'
	sort.addEventListener('click', () => {
		const sorted = [...listedSources()].sort(
			(a, b) => temperature(b.id, activeWindow) - temperature(a.id, activeWindow)
		)
		updateSettings({ sources: withHiddenSources(sorted) })
		sources?.render(listedSources(), activeWindow)
		renderPreview()
	})
	bar.append(el('span', 'temp-label', 'Temperature'), select, sort)
	return bar
}

function allEnabled(): boolean {
	const listed = listedSources()
	return listed.length > 0 && listed.every((setting) => setting.enabled)
}

function updateBulkToggle(): void {
	const button = dialog?.querySelector<HTMLButtonElement>('.bulk-toggle')
	if (button) button.textContent = allEnabled() ? 'Disable all' : 'Enable all'
}

function renderBulkBar(): HTMLElement {
	const bar = el('div', 'bulk-bar')
	const toggle = el('button', 'link-btn bulk-toggle', allEnabled() ? 'Disable all' : 'Enable all')
	toggle.type = 'button'
	toggle.addEventListener('click', () => {
		const enable = !allEnabled()
		const next = listedSources().map((setting) => {
			if (setting.enabled !== enable) {
				recordHeat(setting.id, enable ? HEAT.enable : HEAT.disable)
			}
			return { ...setting, enabled: enable }
		})
		updateSettings({ sources: withHiddenSources(next) })
		sources?.render(listedSources(), activeWindow)
		renderPreview()
		updateBulkToggle()
	})
	const shuffle = el('button', 'link-btn bulk-shuffle', 'Shuffle enabled')
	shuffle.type = 'button'
	shuffle.addEventListener('click', () => {
		const listed = listedSources()
		const enabled = listed.filter((setting) => setting.enabled)
		const disabled = listed.filter((setting) => !setting.enabled)
		for (let i = enabled.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1))
			const a = enabled[i]
			const b = enabled[j]
			if (a && b) {
				enabled[i] = b
				enabled[j] = a
			}
		}
		updateSettings({ sources: withHiddenSources([...enabled, ...disabled]) })
		sources?.render(listedSources(), activeWindow)
		renderPreview()
	})
	bar.append(toggle, shuffle)
	return bar
}

function build(): HTMLDialogElement {
	const sheet = el('dialog', 'sheet')
	sheet.setAttribute('aria-labelledby', 'manage-title')
	sheet.setAttribute('closedby', 'any')
	enableOutsideDismiss(sheet)
	const clearHighlight = (): void => {
		sheet.querySelector('.src.is-highlighted')?.classList.remove('is-highlighted')
	}
	sheet.addEventListener('pointerdown', clearHighlight, { once: true })
	sheet.addEventListener('keydown', clearHighlight, { once: true })

	const head = el('header', 'sheet-head')
	const title = el('h2', undefined, 'Manage sources')
	title.id = 'manage-title'
	const done = el('button', 'link-btn done', 'Done')
	done.type = 'button'
	done.addEventListener('click', () => sheet.close())
	head.append(title, done)

	previewWrap = el('div', 'strip-preview')
	previewWrap.setAttribute('aria-hidden', 'true')
	previewWrap.append(el('p', 'preview-label', 'Preview'))
	preview = el('div', 'strip-row')
	previewWrap.append(preview)

	const body = el('div', 'sheet-body')
	sources = createSourceList({
		onChange: (next) => {
			updateSettings({ sources: withHiddenSources(next) })
			renderPreview()
		},
		scroller: body,
		refresh: () => sources?.render(listedSources(), activeWindow),
		onActive: (id) => {
			activeId = id
			renderPreview()
		},
	})
	tailWatch?.disconnect()
	tailWatch = new ResizeObserver(measureTail)
	tailWatch.observe(sources.nodes[0])
	const prefs = el('div', 'prefs')
	prefs.append(
		renderThemePicker(),
		renderNewTabSwitch(),
		renderEntries(),
		renderSwipeSettings(),
		renderReset()
	)
	const sourcesWrap = el('div', 'sources-wrap')
	sourcesWrap.append(renderTemperatureBar(), renderBulkBar(), previewWrap, ...sources.nodes)
	body.append(sourcesWrap, prefs)

	sheet.append(head, body)
	document.body.append(sheet)
	return sheet
}

export function openManageDialog(focusSource?: string): void {
	dialog?.remove()
	dialog = build()
	sources?.render(listedSources(), activeWindow)
	dialog.showModal()
	renderPreview()
	updateBulkToggle()
	if (matchMedia('(prefers-reduced-motion: no-preference)').matches) {
		const root = getComputedStyle(document.documentElement)
		const ms = Number.parseFloat(root.getPropertyValue('--sheet-move')) * MS_PER_S
		const rise = root.getPropertyValue('--gutter').trim()
		if (ms > 0)
			dialog.animate(
				[
					{ translate: `0 ${rise}`, opacity: 0 },
					{ translate: '0 0', opacity: 1 },
				],
				{ duration: ms, easing: 'ease' }
			)
	}
	if (focusSource) {
		const row = dialog.querySelector<HTMLElement>(`.src[data-id="${focusSource}"]`)
		row?.scrollIntoView({ block: 'center' })
		row?.classList.add('is-highlighted')
	}
	void checkHosted()
}

onAvailabilityChange(() => {
	if (dialog?.open) {
		sources?.render(listedSources(), activeWindow)
		renderPreview()
		updateBulkToggle()
	}
})
