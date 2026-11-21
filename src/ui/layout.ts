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

/**
 * The first shown source after the whole view swipes one source forward or
 * back. The window moves as a whole, so the swipe works from every column and
 * wraps around the ends: after the last full window comes the first, before
 * the first comes the last.
 */
export function windowStep(index: number, count: number, size: number, delta: 1 | -1): number {
	const last = Math.max(0, count - size)
	const next = windowStart(index, count, size) + delta
	if (next < 0) return last
	if (next > last) return 0
	return next
}

/** Whether a source's top entry changed since the reader last saw it. A re-visit then
   starts at the top to show the new arrivals; an unchanged feed keeps the reader's place. */
export function topsChanged(top: string | undefined, seen: string | undefined): boolean {
	return top !== undefined && top !== seen
}
