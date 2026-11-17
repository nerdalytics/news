/**
 * Loaded only with `?debug` in the URL. Shows uncaught errors and the duration
 * of every feed request on the page, for devices without a reachable console.
 */
import { SECOND } from './time'

const panel = document.createElement('pre')
panel.className = 'debug'
panel.textContent = `TheNews debug\n${navigator.userAgent}\n`
document.body.append(panel)

function log(line: string): void {
	const seconds = (performance.now() / SECOND).toFixed(2)
	panel.textContent += `${seconds}s  ${line}\n`
	panel.scrollTop = panel.scrollHeight
}

addEventListener('error', (event) => {
	log(`ERROR ${event.message} (${event.filename.split('/').pop()}:${event.lineno})`)
})

addEventListener('unhandledrejection', (event) => {
	log(`REJECTION ${String(event.reason)}`)
})

addEventListener('thenews:fetch', (event) => {
	const { id, ms, error } = (event as CustomEvent<FetchReport>).detail
	log(`${id} ${error ? `failed after ${ms} ms: ${error}` : `loaded in ${ms} ms`}`)
})

export interface FetchReport {
	id: string
	ms: number
	error?: string
}

log('ready')
