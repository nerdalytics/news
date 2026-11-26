import { isBlocked, isFavorite, setBlocked, setFavorite } from '../settings'
import { HEAT, recordHeat } from '../temperature'
import { el, enableOutsideDismiss } from './dom'

let dialog: HTMLDialogElement | undefined
let site = ''
let sourceId: string | undefined

function render(): void {
	if (!dialog) return
	const favorite = isFavorite(site)
	const blocked = isBlocked(site)
	const title = el('h2', undefined, site)
	title.id = 'site-title'
	const text = favorite
		? 'This site is a favorite. TheNews marks its entries with a star and a faint tint.'
		: blocked
			? 'You blocked this site. TheNews dims its entries and crosses out its name.'
			: 'Favorite this site to highlight its entries, or block it to dim them and cross out its name. Its entries stay in the list either way.'
	const favToggle = el(
		'button',
		'primary-btn',
		favorite ? `Unfavorite ${site}` : `Favorite ${site}`
	)
	favToggle.type = 'button'
	favToggle.addEventListener('click', () => {
		setFavorite(site, !favorite)
		if (sourceId) recordHeat(sourceId, isFavorite(site) ? HEAT.favorite : -HEAT.favorite)
		dialog?.close()
	})
	const blockToggle = el('button', 'secondary-btn', blocked ? `Unblock ${site}` : `Block ${site}`)
	blockToggle.type = 'button'
	blockToggle.addEventListener('click', () => {
		setBlocked(site, !blocked)
		if (sourceId) recordHeat(sourceId, isBlocked(site) ? HEAT.block : -HEAT.block)
		dialog?.close()
	})
	const cancel = el('button', 'link-btn', 'Cancel')
	cancel.type = 'button'
	cancel.addEventListener('click', () => dialog?.close())
	const body = el('div', 'action-body')
	body.append(title, el('p', undefined, text), favToggle, blockToggle, cancel)
	dialog.replaceChildren(body)
}

function build(): HTMLDialogElement {
	const sheet = el('dialog', 'sheet action')
	sheet.setAttribute('aria-labelledby', 'site-title')
	sheet.setAttribute('closedby', 'any')
	enableOutsideDismiss(sheet)
	document.body.append(sheet)
	return sheet
}

export function openSiteDialog(host: string, source?: string): void {
	site = host
	sourceId = source
	dialog ??= build()
	render()
	if (!dialog.open) dialog.showModal()
}
