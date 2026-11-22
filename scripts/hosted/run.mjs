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
