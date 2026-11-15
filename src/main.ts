import { enabledIds, getSettings, type Settings, subscribe } from './settings'
import { Deck } from './ui/deck'

/** The splash never outlives this, measured from the start of navigation. */
const SPLASH_BUDGET_MS = 1000

const THEME_COLOR = { dark: '#0f1012', light: '#ffffff' }

function required<T extends Element>(selector: string): T {
	const node = document.querySelector<T>(selector)
	if (!node) throw new Error(`Missing ${selector}`)
	return node
}

function hideSplash(): void {
	document.getElementById('splash')?.classList.add('is-done')
}

function applyTheme(theme: Settings['theme']): void {
	const root = document.documentElement
	if (theme === 'auto') delete root.dataset.theme
	else root.dataset.theme = theme
	// Browser chrome follows the app theme, not only the system theme.
	for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
		const system = meta.media.includes('dark') ? 'dark' : 'light'
		meta.content = THEME_COLOR[theme === 'auto' ? system : theme]
	}
}

/** The dialog is a separate chunk: fetched on first intent, not on page load. */
function loadManage(): Promise<typeof import('./ui/manage')> {
	return import('./ui/manage')
}

async function openManage(): Promise<void> {
	const { openManageDialog } = await loadManage()
	openManageDialog()
}

const manageButton = required<HTMLButtonElement>('#manage')
manageButton.addEventListener('click', () => void openManage())
// Warm the chunk as soon as a pointer or the keyboard heads for the button.
manageButton.addEventListener('pointerenter', () => void loadManage(), { once: true })
manageButton.addEventListener('focus', () => void loadManage(), { once: true })

const deck = new Deck({
	deck: required<HTMLElement>('#deck'),
	onFirstSettled: hideSplash,
	onManage: () => void openManage(),
	tabs: required<HTMLElement>('#tabs'),
})

function apply(settings: Settings): void {
	applyTheme(settings.theme)
	deck.sync(enabledIds(settings))
	deck.setNewTab(settings.newTab)
}

apply(getSettings())
deck.showFromHash(true)
subscribe(apply)

if (enabledIds().length === 0) hideSplash()
setTimeout(hideSplash, Math.max(0, SPLASH_BUDGET_MS - performance.now()))
