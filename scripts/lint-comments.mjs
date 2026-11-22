import { readFileSync, writeFileSync } from 'node:fs'
import { extract, files } from './comments.mjs'

const EXEMPT = /biome-ignore/
const BUDGET_FILE = 'comment-budget'

const offenders = []
let count = 0
for (const path of files()) {
	for (const c of extract(path)) {
		if (EXEMPT.test(c.text)) continue
		count++
		offenders.push(`${path}:${c.startLine}`)
	}
}

const budget = Number.parseInt(readFileSync(BUDGET_FILE, 'utf8').trim(), 10)

if (process.argv.includes('--write-budget')) {
	writeFileSync(BUDGET_FILE, `${count}\n`)
	console.log(`comment budget ratcheted to ${count}`)
} else if (count > budget) {
	console.error(`${count} comments exceed the budget of ${budget}.`)
	console.error('Delete tautologies and stale notes; move decisions to adr/. Functional biome-ignore comments are exempt.')
	for (const o of offenders) console.error(`  ${o}`)
	process.exit(1)
} else {
	console.log(`${count} comments within budget ${budget}`)
}