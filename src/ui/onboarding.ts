import { isAvailable, onAvailabilityChange } from '../availability'
import { refresh } from '../cache'
import { checkHosted } from '../hosted-check'
import { getSettings, type SourceSetting, updateSettings, withHiddenSources } from '../settings'
import { sourceById } from '../sources/index'
import { LIMIT } from '../sources/types'
import { el } from './dom'
import { createSourceList } from './source-list'

const MARK =
	'<svg viewBox="0 0 64 64" width="48" height="48" aria-hidden="true"><rect width="64" height="64" rx="15" fill="#f0652f"/><path d="M18 22h28M18 32h20M18 42h12" stroke="#fff" stroke-width="6" stroke-linecap="round"/></svg>'

/** Fetches the chosen sources while the reader is still choosing. */
function warmUp(sources: readonly SourceSetting[], started: Set<string>): void {
	for (const { enabled, id } of sources) {
		const source = sourceById(id)
		if (!enabled || !source || started.has(id)) continue
		started.add(id)
		refresh(source, 'low').catch(() => {
			// The column reports the error and offers a retry once it is on screen.
		})
	}
}

/**
 * The first-run screen. No source is on until the reader picks one, and the
 * settings cookie is written only when the reader confirms.
 */
export function showOnboarding(): void {
	const screen = el('dialog', 'onboarding')
	screen.setAttribute('aria-labelledby', 'onboarding-title')
	// The reader has to choose, so Esc does not close this dialog.
	screen.addEventListener('cancel', (event) => event.preventDefault())

	const body = el('div', 'onboarding-body')
	const mark = el('div', 'onboarding-mark')
	mark.innerHTML = MARK
	const title = el('h1', undefined, 'Choose your sources')
	title.id = 'onboarding-title'
	const intro = el(
		'p',
		'onboarding-intro',
		`TheNews shows the top ${LIMIT} entries of every source you switch on. Drag the handles to set the order. You can change both later.`
	)

	const start = el('button', 'primary-btn', 'Start reading')
	start.type = 'button'
	start.disabled = true
	const hint = el('p', 'onboarding-hint', 'Switch on at least one source.')

	const warmed = new Set<string>()
	const list = createSourceList({
		onChange: (sources) => {
			const chosen = sources.some((source) => source.enabled)
			start.disabled = !chosen
			hint.hidden = chosen
			warmUp(sources, warmed)
		},
		scroller: body,
	})
	/** A hosted source is offered only once its feed has been read. */
	const offered = (sources: readonly SourceSetting[]): SourceSetting[] =>
		sources.filter((setting) => {
			const source = sourceById(setting.id)
			return source !== undefined && isAvailable(source)
		})
	list.render(offered(getSettings().sources))
	// Hosted sources join the list when their feeds arrive. The choices made so far are kept.
	onAvailabilityChange(() => {
		if (screen.isConnected) list.render(offered(withHiddenSources(list.read())))
	})
	void checkHosted()

	start.addEventListener('click', () => {
		updateSettings({ sources: withHiddenSources(list.read()) })
		screen.close()
		screen.remove()
	})

	const foot = el('footer', 'onboarding-foot')
	foot.append(hint, start)
	body.append(mark, title, intro, ...list.nodes)
	screen.append(body, foot)
	document.body.append(screen)
	screen.showModal()
}
