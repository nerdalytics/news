import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'

const ROOTS = ['src', 'scripts', 'test']
const EXTRA = ['vite.config.ts', 'index.html']
const SKIP = new Set(['node_modules', 'dist', '.git'])

function walk(dir, out) {
	for (const name of readdirSync(dir)) {
		if (SKIP.has(name)) continue
		const path = join(dir, name)
		if (statSync(path).isDirectory()) walk(path, out)
		else if (['.ts', '.mjs', '.js', '.css', '.html'].includes(extname(name))) out.push(path)
	}
	return out
}

function scanLineComment(src, i, line, comments) {
	const n = src.length
	let j = i + 2
	while (j < n && src[j] !== '\n') j++
	comments.push({
		startLine: line,
		endLine: line,
		startOffset: i,
		endOffset: j,
		type: 'line',
		text: src.slice(i, j),
	})
	return { i: j, line }
}

function scanBlockComment(src, i, line, comments) {
	const n = src.length
	const startLine = line
	let j = i + 2
	while (j < n && !(src[j] === '*' && src[j + 1] === '/')) {
		if (src[j] === '\n') line++
		j++
	}
	const endLine = line
	j = j < n ? j + 2 : j
	comments.push({
		startLine,
		endLine,
		startOffset: i,
		endOffset: j,
		type: 'block',
		text: src.slice(i, j),
	})
	return { i: j, line }
}

function scanQuoted(src, i, line) {
	const n = src.length
	const q = src[i]
	let j = i + 1
	while (j < n) {
		if (src[j] === '\\') {
			if (src[j + 1] === '\n') line++
			j += 2
			continue
		}
		if (src[j] === q) {
			j++
			break
		}
		if (src[j] === '\n') line++
		j++
	}
	return { i: j, line }
}

function scanTemplate(src, i, line, comments) {
	const n = src.length
	let j = i + 1
	while (j < n) {
		if (src[j] === '\\') {
			if (src[j + 1] === '\n') line++
			j += 2
			continue
		}
		if (src[j] === '`') {
			j++
			break
		}
		if (src[j] === '\n') {
			line++
			j++
			continue
		}
		if (src[j] === '$' && src[j + 1] === '{') {
			const r = scan(src, j + 2, line, comments, true)
			j = r.i
			line = r.line
			continue
		}
		j++
	}
	return { i: j, line }
}

const REGEX_KEYWORDS = new Set([
	'return',
	'typeof',
	'case',
	'in',
	'of',
	'new',
	'delete',
	'void',
	'instanceof',
	'do',
	'else',
	'yield',
	'await',
	'throw',
	'var',
	'let',
	'const',
])

function scanRegex(src, i) {
	const n = src.length
	let j = i + 1
	let inClass = false
	while (j < n) {
		const c = src[j]
		if (c === '\n') return 0
		if (c === '\\') {
			if (src[j + 1] === '\n') return 0
			j += 2
			continue
		}
		if (c === '[') inClass = true
		else if (c === ']') inClass = false
		else if (c === '/' && !inClass) {
			j++
			while (j < n && /[A-Za-z]/.test(src[j])) j++
			return j
		}
		j++
	}
	return 0
}

function scan(src, i, line, comments, stopBrace) {
	const n = src.length
	let depth = 0
	let prev = 'op'
	let word = ''
	const endWord = () => {
		if (word) {
			prev = REGEX_KEYWORDS.has(word) ? 'op' : 'value'
			word = ''
		}
	}
	while (i < n) {
		const c = src[i]
		if (c === '\n') {
			endWord()
			line++
			i++
			continue
		}
		if (c === ' ' || c === '\t' || c === '\r') {
			endWord()
			i++
			continue
		}
		if (c === '/' && src[i + 1] === '/') {
			endWord()
			const r = scanLineComment(src, i, line, comments)
			i = r.i
			line = r.line
			continue
		}
		if (c === '/' && src[i + 1] === '*') {
			endWord()
			const r = scanBlockComment(src, i, line, comments)
			i = r.i
			line = r.line
			continue
		}
		if (c === '/' && prev === 'op') {
			endWord()
			const end = scanRegex(src, i)
			if (end) {
				i = end
				prev = 'value'
				continue
			}
		}
		if (c === "'" || c === '"') {
			endWord()
			const r = scanQuoted(src, i, line)
			i = r.i
			line = r.line
			prev = 'value'
			continue
		}
		if (c === '`') {
			endWord()
			const r = scanTemplate(src, i, line, comments)
			i = r.i
			line = r.line
			prev = 'value'
			continue
		}
		if (/[A-Za-z0-9_$]/.test(c)) {
			word += c
			i++
			continue
		}
		endWord()
		if (stopBrace) {
			if (c === '{') depth++
			else if (c === '}') {
				if (depth === 0) return { i: i + 1, line }
				depth--
			}
		}
		if (c !== '.') prev = c === ')' || c === ']' ? 'value' : 'op'
		i++
	}
	return { i, line }
}

function scanCssQuoted(src, i, line) {
	const n = src.length
	const q = src[i]
	let j = i + 1
	while (j < n && src[j] !== q) {
		if (src[j] === '\\') {
			j += 2
			continue
		}
		if (src[j] === '\n') line++
		j++
	}
	return { i: j < n ? j + 1 : j, line }
}

function scanCss(src, comments) {
	const n = src.length
	let i = 0
	let line = 1
	while (i < n) {
		const c = src[i]
		if (c === '\n') {
			line++
			i++
			continue
		}
		if (c === '/' && src[i + 1] === '*') {
			const r = scanBlockComment(src, i, line, comments)
			i = r.i
			line = r.line
			continue
		}
		if (c === "'" || c === '"') {
			const r = scanCssQuoted(src, i, line)
			i = r.i
			line = r.line
			continue
		}
		i++
	}
}

function scanHtml(src, comments) {
	const n = src.length
	let i = 0
	let line = 1
	while (i < n) {
		if (src[i] === '\n') {
			line++
			i++
			continue
		}
		if (src.startsWith('<!--', i)) {
			const startLine = line
			let j = i + 4
			while (j < n && !src.startsWith('-->', j)) {
				if (src[j] === '\n') line++
				j++
			}
			const endLine = line
			j = j < n ? j + 3 : j
			comments.push({ startLine, endLine, startOffset: i, endOffset: j, type: 'block', text: src.slice(i, j) })
			i = j
			continue
		}
		i++
	}
}

export function extract(path) {
	const src = readFileSync(path, 'utf8')
	const comments = []
	const ext = extname(path)
	if (ext === '.css') scanCss(src, comments)
	else if (ext === '.html') scanHtml(src, comments)
	else scan(src, 0, 1, comments, false)
	return comments
}

export function commentLines(comments) {
	return comments.reduce((sum, c) => sum + (c.endLine - c.startLine + 1), 0)
}

export function files() {
	const out = []
	for (const root of ROOTS) walk(root, out)
	for (const extra of EXTRA) if (statSync(extra).isFile()) out.push(extra)
	return out.sort()
}

if (import.meta.url === `file://${process.argv[1]}`) {
	const json = process.argv.includes('--json')
	const inventory = []
	let total = 0
	for (const path of files()) {
		const comments = extract(path)
		const lines = commentLines(comments)
		total += lines
		if (json) inventory.push({ path, lines, comments })
		else if (comments.length) console.log(`${String(lines).padStart(4)}  ${path}  (${comments.length})`)
	}
	if (json) console.log(JSON.stringify({ total, inventory }, null, 2))
	else console.log(`\nTOTAL comment lines: ${total}`)
}