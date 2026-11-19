import { isBlocked, isFavorite, setBlocked, setFavorite } from '../settings'
import { el, enableOutsideDismiss } from './dom'

let dialog: HTMLDialogElement | undefined
let site = ''

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
		dialog?.close()
	})
	const blockToggle = el('button', 'secondary-btn', blocked ? `Unblock ${site}` : `Block ${site}`)
	blockToggle.type = 'button'
	blockToggle.addEventListener('click', () => {
		setBlocked(site, !blocked)
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
	// In browsers that support `closedby`, a click outside or Esc closes the dialog.
	sheet.setAttribute('closedby', 'any')
	// In browsers without `closedby`, close on an outside press-and-release.
	enableOutsideDismiss(sheet)
	document.body.append(sheet)
	return sheet
}

/** Offers to favorite or block a linked site, and to undo either. */
export function openSiteDialog(host: string): void {
	site = host
	dialog ??= build()
	render()
	if (!dialog.open) dialog.showModal()
}
