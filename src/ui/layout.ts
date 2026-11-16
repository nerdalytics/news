/** How many columns of at least `columnMin` pixels fit side by side. Always at least one. */
export function capacity(width: number, columnMin: number): number {
	if (!(width > 0) || !(columnMin > 0)) return 1
	return Math.max(1, Math.floor(width / columnMin))
}

/**
 * The index of the first shown source when `size` columns fit and the reader
 * chose the source at `index`. Near the end of the list the window moves back,
 * so that it stays full.
 */
export function windowStart(index: number, count: number, size: number): number {
	const last = Math.max(0, count - size)
	return Math.min(Math.max(0, index), last)
}
