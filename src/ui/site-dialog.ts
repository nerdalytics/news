import { isBlocked, setBlocked } from '../settings'
import { el } from './dom'

let dialog: HTMLDialogElement | undefined
let site = ''

function render(): void {
	if (!dialog) return
	const blocked = isBlocked(site)
	const title = el('h2', undefined, site)
	title.id = 'site-title'
	const text = blocked
		? 'You blocked this site. TheNews dims its entries and crosses out its name.'
		: 'Block this site if you cannot or do not want to open it. Its entries stay in the list. TheNews dims them and crosses out the name of the site.'
	const toggle = el('button', 'primary-btn', blocked ? `Unblock ${site}` : `Block ${site}`)
	toggle.type = 'button'
	toggle.addEventListener('click', () => {
		setBlocked(site, !blocked)
		dialog?.close()
	})
	const cancel = el('button', 'link-btn', 'Cancel')
	cancel.type = 'button'
	cancel.addEventListener('click', () => dialog?.close())
	const body = el('div', 'action-body')
	body.append(title, el('p', undefined, text), toggle, cancel)
	dialog.replaceChildren(body)
}

function build(): HTMLDialogElement {
	const sheet = el('dialog', 'sheet action')
	sheet.setAttribute('aria-labelledby', 'site-title')
	// In browsers that support `closedby`, a click outside or Esc closes the dialog.
	sheet.setAttribute('closedby', 'any')
	// In other browsers, close on a backdrop click. Its event target is the dialog element.
	sheet.addEventListener('click', (event) => {
		if (event.target === sheet) sheet.close()
	})
	document.body.append(sheet)
	return sheet
}

/** Offers to block a linked site, or to unblock it if it is blocked. */
export function openSiteDialog(host: string): void {
	site = host
	dialog ??= build()
	render()
	if (!dialog.open) dialog.showModal()
}
