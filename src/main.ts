import { enabledIds, getSettings, isFirstVisit, type Settings, subscribe } from './settings'
import { autoHideBar } from './ui/bar'
import { Deck } from './ui/deck'
import { enablePullToRefresh } from './ui/pull'
import { enableSwipe } from './ui/swipe'

/**
 * The app hides the splash when the first column has content, and at the latest
 * this long after navigation starts. Cached feeds render in the first frame, so
 * the limit only matters on a first load without a cache.
 */
const SPLASH_LIMIT_MS = 3000

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
	// Set the browser's toolbar colour to match the chosen theme.
	for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
		const system = meta.media.includes('dark') ? 'dark' : 'light'
		meta.content = THEME_COLOR[theme === 'auto' ? system : theme]
	}
}

/** The dialog is a separate chunk. The browser fetches it when the reader first points at, focuses or clicks the button. */
function loadManage(): Promise<typeof import('./ui/manage')> {
	return import('./ui/manage')
}

async function openManage(): Promise<void> {
	const { openManageDialog } = await loadManage()
	openManageDialog()
}

// `?debug` shows errors and request timings on the page.
if (new URLSearchParams(location.search).has('debug')) void import('./debug')

const manageButton = required<HTMLButtonElement>('#manage')
manageButton.addEventListener('click', () => void openManage())
// Fetch the chunk when the pointer enters the button or the keyboard focuses it.
manageButton.addEventListener('pointerenter', () => void loadManage(), { once: true })
manageButton.addEventListener('focus', () => void loadManage(), { once: true })

async function openSite(site: string): Promise<void> {
	const { openSiteDialog } = await import('./ui/site-dialog')
	openSiteDialog(site)
}

const deckElement = required<HTMLElement>('#deck')
const bar = autoHideBar(required<HTMLElement>('.bar'))

const deck = new Deck({
	deck: deckElement,
	onFirstSettled: hideSplash,
	onJump: () => bar.reset(),
	onManage: () => void openManage(),
	onSite: (site) => void openSite(site),
	tabs: required<HTMLElement>('#tabs'),
})

enablePullToRefresh({ onRefresh: (column) => deck.refresh(column), root: deckElement })
enableSwipe({
	onAction: (row, action) => deck.swipe(row, action),
	root: deckElement,
	settings: () => getSettings().swipe,
})

function apply(settings: Settings): void {
	applyTheme(settings.theme)
	// Rows only give horizontal movement to the script while a swipe gesture is on.
	deckElement.classList.toggle('has-swipe', settings.swipe.read || settings.swipe.unread)
	deck.sync(enabledIds(settings))
	deck.setNewTab(settings.newTab)
	deck.restyle()
}

async function onboard(): Promise<void> {
	const { showOnboarding } = await import('./ui/onboarding')
	showOnboarding()
	hideSplash()
}

apply(getSettings())
deck.showFromHash()
subscribe(apply)

if (isFirstVisit()) void onboard()
else if (enabledIds().length === 0) hideSplash()
setTimeout(hideSplash, Math.max(0, SPLASH_LIMIT_MS - performance.now()))
