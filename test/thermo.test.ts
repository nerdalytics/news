import { describe, expect, it } from 'vitest'
import { thermo } from '../src/ui/thermo'

function fill(svg: SVGElement): SVGElement {
	return svg.querySelector('.thermo-fill') as SVGElement
}

describe('thermo gauge', () => {
	it('fills the tube proportionally to the fraction', () => {
		expect(fill(thermo(0.5)).getAttribute('height')).toBe('12')
		expect(fill(thermo(0.25)).getAttribute('height')).toBe('6')
	})

	it('is empty at zero and full at one', () => {
		expect(fill(thermo(0)).getAttribute('height')).toBe('0')
		expect(fill(thermo(1)).getAttribute('height')).toBe('24')
	})

	it('clamps out-of-range fractions', () => {
		expect(fill(thermo(2)).getAttribute('height')).toBe('24')
		expect(fill(thermo(-1)).getAttribute('height')).toBe('0')
	})

	it('warms from blue to red as it fills', () => {
		expect(fill(thermo(0)).getAttribute('fill')).toContain('hsl(220')
		expect(fill(thermo(1)).getAttribute('fill')).toContain('hsl(0')
	})

	it('renders a vertical thermometer with a bulb', () => {
		const svg = thermo(0.5)
		expect(svg.getAttribute('viewBox')).toBe('0 0 12 32')
		expect(svg.querySelectorAll('circle')).toHaveLength(2)
	})
})
