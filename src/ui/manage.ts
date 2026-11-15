import { getSettings, type SourceSetting, type Theme, updateSettings } from '../settings'
import { sourceById } from '../sources/index'
import type { SourceMeta } from '../sources/types'
import { el, icon } from './dom'
import { enableReorder } from './reorder'

const THEMES: ReadonlyArray<readonly [value: Theme, label: string]> = [
	['auto', 'Auto'],
	['light', 'Light'],
	['dark', 'Dark'],
]

let dialog: HTMLDialogElement | undefined
let list: HTMLUListElement | undefined
let live: HTMLElement | undefined

/** The list in the dialog is the source of truth while it is open. */
function readList(): SourceSetting[] {
	const rows = Array.from(list?.children ?? []) as HTMLElement[]
	return rows.map((row) => ({
		enabled: row.querySelector<HTMLInputElement>('.check')?.checked === true,
		id: row.dataset.id ?? '',
	}))
}

function commit(): void {
	updateSettings({ sources: readList() })
}

function announce(row: HTMLElement): void {
	if (!live || !list) return
	const position = Array.from(list.children).indexOf(row) + 1
	const name = row.querySelector('.src-name')?.textContent ?? ''
	live.textContent = `${name}, position ${position} of ${list.children.length}`
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
	check.addEventListener('change', commit)
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

function renderList(): void {
	if (!list) return
	const rows = getSettings().sources.flatMap((setting) => {
		const source = sourceById(setting.id)
		return source ? [renderRow(source, setting.enabled)] : []
	})
	list.replaceChildren(...rows)
}

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

function build(): HTMLDialogElement {
	const sheet = el('dialog', 'sheet')
	sheet.setAttribute('aria-labelledby', 'manage-title')
	// Light dismiss (click outside, Esc, Android back) where `closedby` is supported.
	sheet.setAttribute('closedby', 'any')
	// Fallback: a click on the backdrop targets the dialog element itself.
	sheet.addEventListener('click', (event) => {
		if (event.target === sheet) sheet.close()
	})

	const head = el('header', 'sheet-head')
	const title = el('h2', undefined, 'Manage Sources')
	title.id = 'manage-title'
	const done = el('button', 'link-btn done', 'Done')
	done.type = 'button'
	done.addEventListener('click', () => sheet.close())
	head.append(title, done)

	const body = el('div', 'sheet-body')
	list = el('ul', 'src-list')
	live = el('p', 'visually-hidden')
	live.setAttribute('aria-live', 'polite')
	enableReorder(list, {
		onChange: commit,
		onMove: announce,
		scroller: body,
	})
	body.append(
		list,
		live,
		renderThemePicker(),
		renderNewTabSwitch(),
		el(
			'p',
			'note',
			'Your choices are saved in cookies in this browser. There is no account and nothing is sent to a tureel server.'
		)
	)

	sheet.append(head, body)
	document.body.append(sheet)
	return sheet
}

export function openManageDialog(): void {
	dialog ??= build()
	renderList()
	if (!dialog.open) dialog.showModal()
}
