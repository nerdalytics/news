import { beforeEach, describe, expect, it } from 'vitest'
import { isBlocked, isFavorite } from '../src/settings'
import { temperature } from '../src/temperature'
import { openSiteDialog } from '../src/ui/site-dialog'

beforeEach(() => {
	localStorage.clear()
	HTMLDialogElement.prototype.showModal = function () {
		this.setAttribute('open', '')
	}
	HTMLDialogElement.prototype.close = function () {
		this.removeAttribute('open')
	}
})

function button(label: string): HTMLButtonElement {
	return Array.from(document.querySelectorAll<HTMLButtonElement>('dialog.action button')).find(
		(node) => node.textContent?.startsWith(label)
	) as HTMLButtonElement
}

describe('site dialog heat', () => {
	it('warms the source on favorite and cools on block', () => {
		openSiteDialog('a.example', 'hn')
		button('Favorite').click()
		expect(isFavorite('a.example')).toBe(true)
		expect(temperature('hn', 'all')).toBeCloseTo(0.5)
		openSiteDialog('b.example', 'hn')
		button('Block').click()
		expect(isBlocked('b.example')).toBe(true)
		expect(temperature('hn', 'all')).toBeCloseTo(0)
	})

	it('records no heat when the source is unknown', () => {
		openSiteDialog('c.example')
		button('Favorite').click()
		expect(isFavorite('c.example')).toBe(true)
		expect(localStorage.getItem('thenews:heat:v1')).toBeNull()
	})
})
