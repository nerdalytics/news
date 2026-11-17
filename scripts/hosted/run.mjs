/**
 * Fetches one hosted source and writes its feed file.
 *
 *   node scripts/hosted/run.mjs <source> <output file>
 *
 * The script exits with an error if the source cannot be read or returns too
 * few entries. The workflow then publishes nothing and the last good feed stays.
 */
import { writeFeed } from './lib.mjs'

const [source, output] = process.argv.slice(2)
if (!/^[a-z0-9]+$/.test(source ?? '') || !output) {
	console.error('Usage: node scripts/hosted/run.mjs <source> <output file>')
	process.exit(2)
}

try {
	const { default: fetchItems } = await import(`./sources/${source}.mjs`)
	const feed = await writeFeed(output, source, await fetchItems())
	console.log(`${source}: wrote ${feed.items.length} entries to ${output}`)
} catch (error) {
	console.error(`${source}: ${error.message}`)
	process.exit(1)
}
