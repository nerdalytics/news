import { readFileSync, writeFileSync } from 'node:fs'
import { extract, files, commentLines } from './comments.mjs'

const EXEMPT = /biome-ignore/

function strip(src, comments) {
	const doomed = comments.filter((c) => !EXEMPT.test(c.text)).sort((a, b) => b.startOffset - a.startOffset)
	let out = src
	for (const c of doomed) {
		const lineStart = out.lastIndexOf('\n', c.startOffset - 1) + 1
		let lineEnd = out.indexOf('\n', c.endOffset)
		if (lineEnd === -1) lineEnd = out.length
		const before = out.slice(lineStart, c.startOffset)
		const after = out.slice(c.endOffset, lineEnd)
		if (before.trim() === '' && after.trim() === '') {
			out = out.slice(0, lineStart) + out.slice(lineEnd + 1)
		} else if (after.trim() === '') {
			out = out.slice(0, c.startOffset).replace(/[ \t]+$/, '') + out.slice(c.endOffset)
		} else {
			out = out.slice(0, c.startOffset) + out.slice(c.endOffset)
		}
	}
	return out
}

let removed = 0
let kept = 0
for (const path of files()) {
	const src = readFileSync(path, 'utf8')
	const comments = extract(path)
	const exempt = comments.filter((c) => EXEMPT.test(c.text)).length
	const gone = comments.length - exempt
	if (!gone) {
		kept += exempt
		continue
	}
	removed += commentLines(comments.filter((c) => !EXEMPT.test(c.text)))
	kept += exempt
	writeFileSync(path, strip(src, comments))
	console.log(`${String(gone).padStart(3)} removed  ${path}`)
}
console.log(`\ncomment lines removed: ${removed}; functional comments kept: ${kept}`)