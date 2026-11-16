import type { FetchContext } from './sources/types'
import { SECOND } from './time'

const TIMEOUT_MS = 12 * SECOND

/** HTTP status codes the app treats specially. */
export const STATUS = { forbidden: 403, notFound: 404, tooManyRequests: 429 } as const

export class HttpError extends Error {
	constructor(
		readonly status: number,
		/** Time in epoch milliseconds after which the source accepts requests again, if the response said so. */
		readonly retryAt?: number
	) {
		super(`HTTP ${status}`)
		this.name = 'HttpError'
	}
}

/** Reads `Retry-After`, or GitHub's `X-RateLimit-Reset`, if the response exposes the header. */
export function retryAtFrom(headers: Headers, now = Date.now()): number | undefined {
	const retryAfter = Number(headers.get('retry-after'))
	if (retryAfter > 0) return now + retryAfter * SECOND
	const reset = Number(headers.get('x-ratelimit-reset'))
	if (reset > 0 && headers.get('x-ratelimit-remaining') === '0') return reset * SECOND
	return undefined
}

async function request(url: string, ctx: FetchContext, accept: string): Promise<Response> {
	const response = await fetch(url, {
		credentials: 'omit',
		// `Accept` is a CORS-safelisted header, so this never causes a preflight.
		headers: { Accept: accept },
		priority: ctx.priority,
		signal: AbortSignal.timeout(TIMEOUT_MS),
	})
	if (!response.ok) throw new HttpError(response.status, retryAtFrom(response.headers))
	return response
}

export async function getJson<T>(url: string, ctx: FetchContext): Promise<T> {
	const response = await request(url, ctx, 'application/json')
	return (await response.json()) as T
}

export async function getText(url: string, ctx: FetchContext, accept: string): Promise<string> {
	const response = await request(url, ctx, accept)
	return response.text()
}

function rateLimitMessage(retryAt: number | undefined): string {
	if (!retryAt) return 'This source is rate limiting requests. Try again in a few minutes.'
	const time = new Date(retryAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
	return `This source is rate limiting requests. Try again after ${time}.`
}

function httpMessage(error: HttpError): string {
	// GitHub answers 403 when its rate limit is used up. Most other APIs answer 429.
	if (error.status === STATUS.forbidden || error.status === STATUS.tooManyRequests) {
		return rateLimitMessage(error.retryAt)
	}
	return `The source answered with an error (HTTP ${error.status}).`
}

/** Returns a short message to show to the reader. */
export function describeError(error: unknown, online = navigator.onLine): string {
	if (error instanceof HttpError) return httpMessage(error)
	if (!online) return 'You are offline.'
	if (error instanceof DOMException && error.name === 'TimeoutError') {
		return 'The source took too long to answer.'
	}
	if (error instanceof TypeError) return 'tureel could not reach the source.'
	return 'tureel could not read the response of the source.'
}
