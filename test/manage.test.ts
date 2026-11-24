import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setGeneratedAt } from '../src/availability'
import { hiddenCount, hide } from '../src/hidden'
import { checkHosted } from '../src/hosted-check'
import { startFresh } from '../src/reset'
import { DESC_MAX, getSettings, updateSettings } from '../src/settings'
import { SOURCES } from '../src/sources/index'
import { SWIPE_ACTIONS } from '../src/ui/gestures'
import { openManageDialog } from '../src/ui/manage'

vi.mock('../src/hosted-check', () => ({ checkHosted: vi.fn(async () => {}) }))
vi.mock('../src/reset', () => ({ startFresh: vi.fn(async () => {}) }))

const RESET_LABEL = 'Start fresh'
const CONFIRM_LABEL = 'Tap again to delete everything'
const CONFIRM_WINDOW_MS = 5000

function sheet(): HTMLDialogElement {
	const dialog = document.querySelector<HTMLDialogElement>('dialog.sheet')
	if (!dialog) throw new Error('manage sheet not in the document')
	return dialog
}

function row(id: string): HTMLElement {
	const node = sheet().querySelector<HTMLElement>(`.src[data-id="${id}"]`)
	if (!node) throw new Error(`source row ${id} not rendered`)
	return node
}

function switchInput(label: string): HTMLInputElement {
	const rows = Array.from(sheet().querySelectorAll<HTMLElement>('.switch-row'))
	const match = rows.find((node) => node.textContent?.includes(label))
	const input = match?.querySelector<HTMLInputElement>('input.switch')
	if (!input) throw new Error(`switch ${label} not rendered`)
	return input
}

function swipeSelect(label: string): HTMLSelectElement {
	const rows = Array.from(sheet().querySelectorAll<HTMLElement>('.select-row'))
	const match = rows.find((node) => node.textContent?.includes(label))
	const select = match?.querySelector<HTMLSelectElement>('select')
	if (!select) throw new Error(`swipe select ${label} not rendered`)
	return select
}

function setChecked(input: HTMLInputElement, checked: boolean): void {
	input.checked = checked
	input.dispatchEvent(new Event('change', { bubbles: true }))
}

beforeEach(() => {
	vi.clearAllMocks()
	localStorage.clear()
	vi.stubGlobal(
		'matchMedia',
		vi.fn(() => ({ matches: false, addEventListener() {}, removeEventListener() {} }))
	)
	vi.stubGlobal(
		'ResizeObserver',
		class {
			observe() {}
			unobserve() {}
			disconnect() {}
		}
	)
	Element.prototype.scrollIntoView = vi.fn()
	HTMLDialogElement.prototype.showModal = function () {
		this.setAttribute('open', '')
	}
	HTMLDialogElement.prototype.close = function () {
		this.removeAttribute('open')
	}
	updateSettings({
		theme: 'auto',
		newTab: false,
		descLines: DESC_MAX,
		showStatus: true,
		swipe: {},
		sources: [
			{ id: 'hn', enabled: true },
			{ id: 'github', enabled: false },
		],
	})
})

afterEach(() => {
	vi.useRealTimers()
	vi.unstubAllGlobals()
	Reflect.deleteProperty(Element.prototype, 'scrollIntoView')
	Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal')
	Reflect.deleteProperty(HTMLDialogElement.prototype, 'close')
	document.body.replaceChildren()
	localStorage.clear()
})

describe('openManageDialog', () => {
	it('builds the sheet with title, prefs and the listed source rows', () => {
		openManageDialog()
		expect(sheet().open).toBe(true)
		expect(sheet().querySelector('h2')?.textContent).toBe('Manage sources')
		expect(sheet().querySelector('legend')?.textContent).toBe('Appearance')
		const headings = Array.from(sheet().querySelectorAll('h3')).map((node) => node.textContent)
		expect(headings).toEqual(expect.arrayContaining(['Swipe gestures', 'Entries', 'Start fresh']))
		expect(
			Array.from(sheet().querySelectorAll<HTMLElement>('.src')).map((node) => node.dataset.id)
		).toEqual(['hn', 'github'])
		expect(checkHosted).toHaveBeenCalled()
	})

	it('replaces a previous sheet on reopen', () => {
		openManageDialog()
		openManageDialog()
		expect(document.querySelectorAll('dialog.sheet')).toHaveLength(1)
	})

	it('closes the sheet from the Done button', () => {
		openManageDialog()
		sheet().querySelector<HTMLButtonElement>('.done')?.click()
		expect(sheet().open).toBe(false)
	})
})

describe('appearance and entry prefs', () => {
	it('reflects the stored theme and writes a change back', () => {
		updateSettings({ theme: 'dark' })
		openManageDialog()
		const radios = Array.from(sheet().querySelectorAll<HTMLInputElement>('input[name="theme"]'))
		expect(radios.map((radio) => radio.value)).toEqual(['auto', 'light', 'dark'])
		expect(radios.find((radio) => radio.value === 'dark')?.checked).toBe(true)
		const light = radios.find((radio) => radio.value === 'light')
		if (light) setChecked(light, true)
		expect(getSettings().theme).toBe('light')
		expect(document.cookie).toContain('thenews_theme=light')
	})

	it('reflects and updates the new-tab switch', () => {
		openManageDialog()
		const toggle = switchInput('Open links in a new tab')
		expect(toggle.checked).toBe(false)
		setChecked(toggle, true)
		expect(getSettings().newTab).toBe(true)
	})

	it('maps the description slider to Off, line counts and Max', () => {
		openManageDialog()
		const slider = sheet().querySelector<HTMLInputElement>('input[type="range"]')
		const label = sheet().querySelector('.slider-value')
		if (!slider || !label) throw new Error('slider not rendered')
		expect(slider.max).toBe(String(DESC_MAX))
		expect(slider.value).toBe(String(DESC_MAX))
		expect(label.textContent).toBe('Max')
		for (const [value, text] of [
			['0', 'Off'],
			['1', '1 line'],
			['2', '2 lines'],
		] as const) {
			slider.value = value
			slider.dispatchEvent(new Event('input', { bubbles: true }))
			expect(label.textContent).toBe(text)
			expect(getSettings().descLines).toBe(Number(value))
		}
	})

	it('reflects and updates the status-row switch', () => {
		openManageDialog()
		const toggle = switchInput('Show status row')
		expect(toggle.checked).toBe(true)
		setChecked(toggle, false)
		expect(getSettings().showStatus).toBe(false)
	})
})

describe('swipe selects', () => {
	it('offers Nothing plus every known action and reflects the stored assignment', () => {
		updateSettings({ swipe: { left: 'read' } })
		openManageDialog()
		const select = swipeSelect('Short swipe left')
		expect(Array.from(select.options).map((option) => option.value)).toEqual(['', ...SWIPE_ACTIONS])
		expect(select.value).toBe('read')
	})

	it('writes a chosen action and deletes the slot on Nothing', () => {
		openManageDialog()
		const select = swipeSelect('Short swipe left')
		select.value = 'hide'
		select.dispatchEvent(new Event('change', { bubbles: true }))
		expect(getSettings().swipe.left).toBe('hide')
		select.value = ''
		select.dispatchEvent(new Event('change', { bubbles: true }))
		expect(getSettings().swipe.left).toBeUndefined()
	})
})

describe('hidden entries', () => {
	it('shows the zero state without a restore button', () => {
		openManageDialog()
		const line = sheet().querySelector('.hidden-entries')
		expect(line?.childNodes[0]?.textContent).toBe('0 hidden entries. ')
		expect(line?.querySelector('button')).toBeNull()
	})

	it('uses the singular for one hidden entry and restores on demand', () => {
		hide('https://a.example/')
		openManageDialog()
		const line = sheet().querySelector('.hidden-entries')
		expect(line?.childNodes[0]?.textContent).toBe('1 hidden entry. ')
		line?.querySelector<HTMLButtonElement>('button')?.click()
		expect(hiddenCount()).toBe(0)
		expect(sheet().querySelector('.hidden-entries')?.childNodes[0]?.textContent).toBe(
			'0 hidden entries. '
		)
	})

	it('uses the plural for several hidden entries', () => {
		hide('https://a.example/')
		hide('https://b.example/')
		openManageDialog()
		expect(sheet().querySelector('.hidden-entries')?.childNodes[0]?.textContent).toBe(
			'2 hidden entries. '
		)
	})
})

describe('start fresh', () => {
	it('arms on the first tap and resets on the second', async () => {
		openManageDialog()
		const button = sheet().querySelector<HTMLButtonElement>('.warning-btn')
		if (!button) throw new Error('reset button not rendered')
		button.click()
		expect(button.textContent).toBe(CONFIRM_LABEL)
		button.click()
		await vi.waitFor(() => expect(startFresh).toHaveBeenCalledTimes(1))
	})

	it('disarms after the confirm window and needs a fresh first tap', () => {
		vi.useFakeTimers()
		openManageDialog()
		const button = sheet().querySelector<HTMLButtonElement>('.warning-btn')
		if (!button) throw new Error('reset button not rendered')
		button.click()
		expect(button.textContent).toBe(CONFIRM_LABEL)
		vi.advanceTimersByTime(CONFIRM_WINDOW_MS)
		expect(button.textContent).toBe(RESET_LABEL)
		button.click()
		expect(button.textContent).toBe(CONFIRM_LABEL)
		expect(startFresh).not.toHaveBeenCalled()
	})
})

describe('focusSource', () => {
	it('highlights and scrolls to the requested row, cleared on the next pointerdown', () => {
		openManageDialog('hn')
		expect(row('hn').classList.contains('is-highlighted')).toBe(true)
		expect(Element.prototype.scrollIntoView).toHaveBeenCalled()
		sheet().dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
		expect(row('hn').classList.contains('is-highlighted')).toBe(false)
	})
})

describe('source list and preview', () => {
	it('writes checkbox changes back and keeps ids that are not listed', () => {
		updateSettings({
			sources: [
				{ id: 'hn', enabled: true },
				{ id: 'zzz', enabled: false },
			],
		})
		openManageDialog()
		expect(
			Array.from(sheet().querySelectorAll<HTMLElement>('.src')).map((node) => node.dataset.id)
		).toEqual(['hn'])
		setChecked(row('hn').querySelector<HTMLInputElement>('.check') as HTMLInputElement, false)
		expect(getSettings().sources).toEqual([
			{ id: 'hn', enabled: false },
			{ id: 'zzz', enabled: false },
		])
	})

	it('previews only enabled sources and refreshes on change', () => {
		openManageDialog()
		const badges = (): string[] =>
			Array.from(sheet().querySelectorAll<HTMLElement>('.preview-badge')).map(
				(node) => node.dataset.id ?? ''
			)
		expect(badges()).toEqual(['hn'])
		setChecked(row('github').querySelector<HTMLInputElement>('.check') as HTMLInputElement, true)
		expect(badges()).toEqual(['hn', 'github'])
	})
})

describe('availability changes', () => {
	it('re-renders the open sheet when a hosted source becomes unavailable', () => {
		const hosted = SOURCES.find((source) => source.hosted)
		if (!hosted) throw new Error('catalogue has no hosted source')
		setGeneratedAt(hosted.id, Date.now())
		updateSettings({
			sources: [
				{ id: 'hn', enabled: true },
				{ id: hosted.id, enabled: true },
			],
		})
		openManageDialog()
		expect(sheet().querySelector(`.src[data-id="${hosted.id}"]`)).not.toBeNull()
		setGeneratedAt(hosted.id, undefined)
		expect(sheet().querySelector(`.src[data-id="${hosted.id}"]`)).toBeNull()
	})
})
