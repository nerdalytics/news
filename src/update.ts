import { MINUTE } from './time'

const CHECK_INTERVAL_MS = 10 * MINUTE
const RELOADED_FOR_KEY = 'thenews:reloaded-for'

let lastCheck = 0

async function latestBuild(): Promise<string | undefined> {
	try {
		const response = await fetch('version.json', { cache: 'no-store' })
		if (!response.ok) return undefined
		const { build } = (await response.json()) as { build?: unknown }
		return typeof build === 'string' ? build : undefined
	} catch {
		return undefined
	}
}

function alreadyTried(build: string): boolean {
	try {
		if (sessionStorage.getItem(RELOADED_FOR_KEY) === build) return true
		sessionStorage.setItem(RELOADED_FOR_KEY, build)
		return false
	} catch {
		return true
	}
}

async function check(): Promise<void> {
	if (document.visibilityState !== 'visible') return
	if (performance.now() - lastCheck < CHECK_INTERVAL_MS && lastCheck > 0) return
	lastCheck = performance.now()
	const build = await latestBuild()
	if (!build || build === __BUILD_ID__ || alreadyTried(build)) return
	location.reload()
}

export function watchForUpdates(): void {
	document.addEventListener('visibilitychange', () => void check())
	addEventListener('pageshow', (event) => {
		if (event.persisted) void check()
	})
}
