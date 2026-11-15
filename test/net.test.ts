import { describe, expect, it } from 'vitest'
import { describeError, HttpError, retryAtFrom } from '../src/net'

describe('retryAtFrom', () => {
	const now = 1_000_000

	it('reads Retry-After in seconds', () => {
		expect(retryAtFrom(new Headers({ 'retry-after': '30' }), now)).toBe(now + 30_000)
	})

	it('reads the GitHub rate limit reset once the budget is used up', () => {
		const headers = new Headers({ 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '2000' })
		expect(retryAtFrom(headers, now)).toBe(2_000_000)
	})

	it('ignores the reset time while requests remain', () => {
		const headers = new Headers({ 'x-ratelimit-remaining': '7', 'x-ratelimit-reset': '2000' })
		expect(retryAtFrom(headers, now)).toBeUndefined()
	})
})

describe('describeError', () => {
	it('explains rate limits', () => {
		expect(describeError(new HttpError(429), true)).toContain('rate limiting')
		expect(describeError(new HttpError(403, Date.now() + 60_000), true)).toContain(
			'Try again after'
		)
	})

	it('reports other HTTP errors with their status', () => {
		expect(describeError(new HttpError(503), true)).toContain('HTTP 503')
	})

	it('distinguishes offline, timeout and unreachable', () => {
		expect(describeError(new TypeError('Failed to fetch'), false)).toContain('offline')
		expect(describeError(new DOMException('timed out', 'TimeoutError'), true)).toContain('too long')
		expect(describeError(new TypeError('Failed to fetch'), true)).toContain('could not be reached')
	})
})
