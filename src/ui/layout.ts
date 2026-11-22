export function capacity(width: number, columnMin: number): number {
	if (!(width > 0) || !(columnMin > 0)) return 1
	return Math.max(1, Math.floor(width / columnMin))
}

export function windowStart(index: number, count: number, size: number): number {
	const last = Math.max(0, count - size)
	return Math.min(Math.max(0, index), last)
}

export function windowStep(index: number, count: number, size: number, delta: 1 | -1): number {
	const last = Math.max(0, count - size)
	const next = windowStart(index, count, size) + delta
	if (next < 0) return last
	if (next > last) return 0
	return next
}

export function topsChanged(top: string | undefined, seen: string | undefined): boolean {
	return top !== undefined && top !== seen
}
