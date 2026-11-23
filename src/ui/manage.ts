import { isAvailable, onAvailabilityChange } from '../availability'
import { hiddenCount, showAllHidden } from '../hidden'
import { checkHosted } from '../hosted-check'
import {
	getSettings,
	type SourceSetting,
	type Theme,
	updateSettings,
	withHiddenSources,
} from '../settings'
import { sourceById } from '../sources/index'
import { el, enableOutsideDismiss } from './dom'
import { SWIPE_ACTIONS, SWIPE_LABELS, type SwipeSlot } from './gestures'
import { createSourceList, type SourceList } from './source-list'

const THEMES: ReadonlyArray<readonly [value: Theme, label: string]> = [
	['auto', 'Auto'],
	['light', 'Light'],
	['dark', 'Dark'],
]

let dialog: HTMLDialogElement | undefined
let sources: SourceList | undefined

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
	['leftLong', 'Long swipe left'],
	['right', 'Short swipe right'],
	['rightLong', 'Long swipe right'],
]

const NO_ACTION = ''

function renderSwipeSelect(slot: SwipeSlot, label: string): HTMLElement {
	const row = el('label', 'select-row')
	const select = el('select', 'select')
	select.append(new Option('Nothing', NO_ACTION))
	for (const action of SWIPE_ACTIONS) select.append(new Option(SWIPE_LABELS[action], action))
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
	const section = el('section', 'pref')
	section.append(
		el('h3', undefined, 'Swipe gestures'),
		...SLOT_LABELS.map(([slot, label]) => renderSwipeSelect(slot, label)),
		renderHiddenEntries()
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
			'Deletes your sources, blocked sites, opened links and cached feeds from this browser. TheNews then shows the first-run screen.'
		),
		button
	)
	return section
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

	const body = el('div', 'sheet-body')
	sources = createSourceList({
		onChange: (next) => updateSettings({ sources: withHiddenSources(next) }),
		scroller: body,
		refresh: () => sources?.render(listedSources()),
	})
	const prefs = el('div', 'prefs')
	prefs.append(
		renderThemePicker(),
		renderNewTabSwitch(),
		renderSwipeSettings(),
		renderReset(),
		el(
			'p',
			'note',
			'TheNews saves these settings in this browser, in cookies and local storage. It has no accounts and no server of its own.'
		)
	)
	body.append(...sources.nodes, prefs)

	sheet.append(head, body)
	document.body.append(sheet)
	return sheet
}

export function openManageDialog(focusSource?: string): void {
	dialog?.remove()
	dialog = build()
	sources?.render(listedSources())
	dialog.showModal()
	if (focusSource) {
		const row = dialog.querySelector<HTMLElement>(`.src[data-id="${focusSource}"]`)
		row?.scrollIntoView({ block: 'center' })
		row?.classList.add('is-highlighted')
	}
	void checkHosted()
}

onAvailabilityChange(() => {
	if (dialog?.open) sources?.render(listedSources())
})
