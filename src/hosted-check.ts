import { isAvailable } from './availability'
import { isFresh, peek, refresh } from './cache'
import { hostedSources } from './sources/index'
import type { SourceMeta } from './sources/types'

export async function checkHosted(sources: readonly SourceMeta[] = hostedSources()): Promise<void> {
	await Promise.all(
		sources.map((source) => {
			const cached = peek(source.id)
			if (isAvailable(source) && cached && isFresh(cached, source)) return undefined
			return refresh(source, 'low').catch(() => {})
		})
	)
}
