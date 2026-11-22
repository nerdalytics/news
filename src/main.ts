import { isAvailable, onAvailabilityChange } from './availability'
import { checkHosted } from './hosted-check'
import { enabledIds, getSettings, isFirstVisit, type Settings, subscribe } from './settings'
import { hostedSources, sourceById } from './sources/index'
import { autoHideBar } from './ui/bar'
import { Deck } from './ui/deck'
import { whenIdle } from './ui/dom'
import { enablePullToRefresh } from './ui/pull'
import { enableSwipe } from './ui/swipe'
import { watchForUpdates } from './update'

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
	for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
		const system = meta.media.includes('dark') ? 'dark' : 'light'
		meta.content = THEME_COLOR[theme === 'auto' ? system : theme]
	}
}

function loadManage(): Promise<typeof import('./ui/manage')> {
	return import('./ui/manage')
}

async function openManage(sourceId?: string): Promise<void> {
	const { openManageDialog } = await loadManage()
	openManageDialog(sourceId)
}

if (new URLSearchParams(location.search).has('debug')) void import('./debug')

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
	onManage: (sourceId) => void openManage(sourceId),
	onSite: (site) => void openSite(site),
	tabs: required<HTMLElement>('#tabs'),
})

enablePullToRefresh({ onRefresh: (column) => deck.refresh(column), root: deckElement })
enableSwipe({
	applies: (row, action) => deck.swipeApplies(row, action),
	label: (row, action) => deck.swipeLabel(row, action),
	onAction: (row, action) => deck.swipe(row, action),
	root: deckElement,
	settings: () => getSettings().swipe,
})

function shownIds(settings: Settings): string[] {
	return enabledIds(settings).filter((id) => {
		const source = sourceById(id)
		return source !== undefined && isAvailable(source)
	})
}

function apply(settings: Settings): void {
	applyTheme(settings.theme)
	deckElement.classList.toggle('has-swipe', Object.values(settings.swipe).some(Boolean))
	deck.sync(shownIds(settings))
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
onAvailabilityChange(() => apply(getSettings()))
watchForUpdates()

whenIdle(() => {
	const enabled = new Set(enabledIds())
	void checkHosted(
		hostedSources().filter((source) => enabled.has(source.id) && !isAvailable(source))
	)
})

if (isFirstVisit()) void onboard()
else if (enabledIds().length === 0) hideSplash()
setTimeout(hideSplash, Math.max(0, SPLASH_LIMIT_MS - performance.now()))
