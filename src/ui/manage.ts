import { getSettings, type Theme, updateSettings } from '../settings'
import { el } from './dom'
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

function renderNewTabSwitch(): HTMLElement {
	const row = el('label', 'pref switch-row')
	const toggle = el('input', 'switch')
	toggle.type = 'checkbox'
	toggle.setAttribute('role', 'switch')
	toggle.checked = getSettings().newTab
	toggle.addEventListener('change', () => updateSettings({ newTab: toggle.checked }))
	row.append(el('span', undefined, 'Open links in a new tab'), toggle)
	return row
}

/** The reader has this long to confirm before the button returns to its first label. */
const CONFIRM_WINDOW_MS = 5000
const RESET_LABEL = 'Start fresh'
const CONFIRM_LABEL = 'Tap again to delete everything'

/** Deletes everything tureel stored. The first tap arms the button, the second one confirms. */
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
			'Deletes your sources, blocked sites, opened links and cached feeds from this browser. tureel then shows the first-run screen.'
		),
		button
	)
	return section
}

function build(): HTMLDialogElement {
	const sheet = el('dialog', 'sheet')
	sheet.setAttribute('aria-labelledby', 'manage-title')
	// In browsers that support `closedby`, a click outside, Esc or the Android
	// back gesture closes the dialog.
	sheet.setAttribute('closedby', 'any')
	// In other browsers, close on a backdrop click. Its event target is the dialog element.
	sheet.addEventListener('click', (event) => {
		if (event.target === sheet) sheet.close()
	})

	const head = el('header', 'sheet-head')
	const title = el('h2', undefined, 'Manage sources')
	title.id = 'manage-title'
	const done = el('button', 'link-btn done', 'Done')
	done.type = 'button'
	done.addEventListener('click', () => sheet.close())
	head.append(title, done)

	const body = el('div', 'sheet-body')
	sources = createSourceList({
		onChange: (next) => updateSettings({ sources: next }),
		scroller: body,
	})
	body.append(
		...sources.nodes,
		renderThemePicker(),
		renderNewTabSwitch(),
		el(
			'p',
			'note',
			'tureel saves these settings in this browser, in cookies and local storage. It has no accounts and no server of its own.'
		),
		renderReset()
	)

	sheet.append(head, body)
	document.body.append(sheet)
	return sheet
}

export function openManageDialog(): void {
	dialog ??= build()
	sources?.render(getSettings().sources)
	if (!dialog.open) dialog.showModal()
}
