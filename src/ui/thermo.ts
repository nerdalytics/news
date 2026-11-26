const NS = 'http://www.w3.org/2000/svg'
const TUBE_BOTTOM = 26
const TUBE_HEIGHT = 24

function part(name: string, attrs: Record<string, string>): SVGElement {
	const node = document.createElementNS(NS, name)
	for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value)
	return node
}

export function thermo(fraction: number): SVGElement {
	const f = Math.max(0, Math.min(1, fraction))
	const color = `hsl(${Math.round((1 - f) * 220)} 80% 55%)`
	const top = TUBE_BOTTOM - f * TUBE_HEIGHT
	const svg = part('svg', { viewBox: '0 0 12 32', class: 'thermo', 'aria-hidden': 'true' })
	svg.append(
		part('rect', {
			x: '3.5',
			y: '1',
			width: '5',
			height: '25',
			rx: '2.5',
			class: 'thermo-glass',
		}),
		part('circle', { cx: '6', cy: '27', r: '4.5', class: 'thermo-glass' }),
		part('circle', { cx: '6', cy: '27', r: '3', fill: color }),
		part('rect', {
			x: '4.5',
			y: String(top),
			width: '3',
			height: String(TUBE_BOTTOM - top),
			fill: color,
			class: 'thermo-fill',
		})
	)
	return svg
}
