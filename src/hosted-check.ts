import { isAvailable } from './availability'
import { isFresh, peek, refresh } from './cache'
import { hostedSources } from './sources/index'
import type { SourceMeta } from './sources/types'

/**
 * Reads the feeds of hosted sources, which also records whether each source is
 * available. A source that is listed and has a fresh feed in the cache costs
 * no request.
 */
export async function checkHosted(sources: readonly SourceMeta[] = hostedSources()): Promise<void> {
	await Promise.all(
		sources.map((source) => {
			const cached = peek(source.id)
			if (isAvailable(source) && cached && isFresh(cached, source)) return undefined
			return refresh(source, 'low').catch(() => {
				// The adapter has recorded the outcome. A hidden source needs no error message.
			})
		})
	)
}
