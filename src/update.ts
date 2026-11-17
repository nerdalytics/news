import { MINUTE } from './time'

/**
 * Keeps a long-lived page up to date. A web app on the home screen can stay in
 * memory for days, so it never loads the new files of a later release.
 *
 * Every build writes its id to `version.json`. When the reader returns to the
 * page, the app compares that file with the id it was built with and reloads
 * if they differ.
 */

/** The app asks for `version.json` at most this often. */
const CHECK_INTERVAL_MS = 10 * MINUTE
/** Remembers the build a reload was made for, so a stale server copy cannot cause a reload loop. */
const RELOADED_FOR_KEY = 'thenews:reloaded-for'

let lastCheck = 0

async function latestBuild(): Promise<string | undefined> {
	try {
		const response = await fetch('version.json', { cache: 'no-store' })
		if (!response.ok) return undefined
		const { build } = (await response.json()) as { build?: unknown }
		return typeof build === 'string' ? build : undefined
	} catch {
		// Offline, or the file is missing as on the development server.
		return undefined
	}
}

/** True if a reload for this build was already tried in this browser tab. */
function alreadyTried(build: string): boolean {
	try {
		if (sessionStorage.getItem(RELOADED_FOR_KEY) === build) return true
		sessionStorage.setItem(RELOADED_FOR_KEY, build)
		return false
	} catch {
		// Without session storage there is no loop protection, so do not reload at all.
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

/** Checks for a new release whenever the reader comes back to the page. */
export function watchForUpdates(): void {
	document.addEventListener('visibilitychange', () => void check())
	addEventListener('pageshow', (event) => {
		if (event.persisted) void check()
	})
}
