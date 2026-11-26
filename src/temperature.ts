export const WINDOWS = ['hour', 'day', 'week', 'month', 'quarter', 'year', 'all'] as const
export type Window = (typeof WINDOWS)[number]

export const WINDOW_LABELS: Record<Window, string> = {
	hour: 'Last hour',
	day: 'Last day',
	week: 'Last week',
	month: 'Last month',
	quarter: 'Last quarter',
	year: 'Last year',
	all: 'All time',
}

const HOUR = 3_600_000
const DAY = 24 * HOUR
const YEAR = 365 * DAY
const HALF_LIFE: Record<Window, number> = {
	hour: HOUR,
	day: DAY,
	week: 7 * DAY,
	month: YEAR / 12,
	quarter: YEAR / 4,
	year: YEAR,
	all: Number.POSITIVE_INFINITY,
}

const KEY = 'thenews:heat:v1'

interface Heat {
	at: number
	v: number[]
}

function load(): Record<string, Heat> {
	try {
		const stored: unknown = JSON.parse(localStorage.getItem(KEY) ?? '{}')
		if (!stored || typeof stored !== 'object') return {}
		const out: Record<string, Heat> = {}
		for (const [id, value] of Object.entries(stored)) {
			const heat = value as Partial<Heat>
			if (
				typeof heat.at === 'number' &&
				Array.isArray(heat.v) &&
				heat.v.length === WINDOWS.length &&
				heat.v.every((n) => typeof n === 'number')
			) {
				out[id] = { at: heat.at, v: heat.v as number[] }
			}
		}
		return out
	} catch {
		return {}
	}
}

function save(store: Record<string, Heat>): void {
	try {
		localStorage.setItem(KEY, JSON.stringify(store))
	} catch {}
}

function decay(value: number, elapsed: number, window: Window): number {
	return value * 2 ** (-Math.max(0, elapsed) / HALF_LIFE[window])
}

export function recordRead(sourceId: string, now: number = Date.now()): void {
	const store = load()
	const heat = store[sourceId] ?? { at: now, v: WINDOWS.map(() => 0) }
	store[sourceId] = {
		at: now,
		v: WINDOWS.map((window, i) => decay(heat.v[i] ?? 0, now - heat.at, window) + 1),
	}
	save(store)
}

export function temperature(sourceId: string, window: Window, now: number = Date.now()): number {
	const heat = load()[sourceId]
	if (!heat) return 0
	return decay(heat.v[WINDOWS.indexOf(window)] ?? 0, now - heat.at, window)
}

export function sortByTemperature(
	ids: readonly string[],
	window: Window,
	now: number = Date.now()
): string[] {
	return [...ids].sort((a, b) => temperature(b, window, now) - temperature(a, window, now))
}
