import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { commentLines, extract } from '../scripts/comments.mjs'

const dir = mkdtempSync(join(tmpdir(), 'comments-test-'))
let seq = 0

afterAll(() => {
	rmSync(dir, { recursive: true, force: true })
})

function extractFrom(source: string, ext: string) {
	const path = join(dir, `fixture-${seq++}${ext}`)
	writeFileSync(path, source)
	return extract(path)
}

describe('scan via extract (.ts)', () => {
	it('captures a line comment with its exact span', () => {
		expect(extractFrom('// hello\nconst a = 1\n', '.ts')).toEqual([
			{
				startLine: 1,
				endLine: 1,
				startOffset: 0,
				endOffset: 8,
				type: 'line',
				text: '// hello',
			},
		])
	})

	it('captures a multi-line block comment with its line span', () => {
		const [comment] = extractFrom('/* a\nb */\n', '.ts')
		expect(comment).toMatchObject({ startLine: 1, endLine: 2, type: 'block', text: '/* a\nb */' })
	})

	it('runs an unterminated block comment to the end of the source', () => {
		const [comment] = extractFrom('/* open', '.ts')
		expect(comment).toMatchObject({ startLine: 1, endLine: 1, type: 'block', text: '/* open' })
		expect(comment?.endOffset).toBe(7)
	})

	it('ignores comment markers inside single and double quotes', () => {
		expect(extractFrom('const s = "// not";\n', '.ts')).toEqual([])
		expect(extractFrom("const s = '/* not */';\n", '.ts')).toEqual([])
	})

	it('handles an escaped quote inside a string', () => {
		const comments = extractFrom("const s = 'a\\'b'; // real\n", '.ts')
		expect(comments.map((c) => c.text)).toEqual(['// real'])
	})

	it('counts a backslash line continuation inside a string', () => {
		const comments = extractFrom("const s = 'a\\\nb'; // c\n", '.ts')
		expect(comments.map((c) => [c.text, c.startLine])).toEqual([['// c', 2]])
	})

	it('finds comments inside template interpolation and after the template', () => {
		const comments = extractFrom('const t = `x${/* inner */ 1}y`; // outer\n', '.ts')
		expect(comments.map((c) => c.text)).toEqual(['/* inner */', '// outer'])
	})

	it('does not end interpolation early on nested braces', () => {
		const comments = extractFrom('const t = `${ {a: {b: 1}} }`; // after\n', '.ts')
		expect(comments.map((c) => c.text)).toEqual(['// after'])
	})

	it('does not close a template on an escaped backtick', () => {
		const comments = extractFrom('const t = `a\\`b`; // c\n', '.ts')
		expect(comments.map((c) => c.text)).toEqual(['// c'])
	})

	it('treats a block opener inside a line comment as text', () => {
		const comments = extractFrom('// /* not a block\n', '.ts')
		expect(comments.map((c) => c.type)).toEqual(['line'])
	})

	it('does not start a string on a quote inside a block comment', () => {
		const comments = extractFrom("/* it's */ // c\n", '.ts')
		expect(comments.map((c) => c.text)).toEqual(["/* it's */", '// c'])
	})
})

describe('regex literals (.ts)', () => {
	it('does not let quotes inside a regex hide a following comment', () => {
		const comments = extractFrom(
			'const a = /rel="x"[^>]*href="([^"]+)"/.exec(s)\n/** real */\n',
			'.ts'
		)
		expect(comments.map((c) => c.text)).toEqual(['/** real */'])
	})

	it('treats a regex after return as a regex, not division', () => {
		const comments = extractFrom('function f() { return /a"b/.test(s) }\n// real\n', '.ts')
		expect(comments.map((c) => c.text)).toEqual(['// real'])
	})

	it('does not count comment markers inside a regex', () => {
		expect(extractFrom('const a = /"//"/.test(s)\n', '.ts')).toEqual([])
	})

	it('keeps division as division', () => {
		const comments = extractFrom('const a = b / c / d\n// real\n', '.ts')
		expect(comments.map((c) => c.text)).toEqual(['// real'])
	})

	it('keeps member-access division as division', () => {
		const comments = extractFrom('const a = b.c / d\n// real\n', '.ts')
		expect(comments.map((c) => c.text)).toEqual(['// real'])
	})

	it('handles a slash inside a character class and regex flags', () => {
		const comments = extractFrom('const a = /[/]/gi.test(s)\n// real\n', '.ts')
		expect(comments.map((c) => c.text)).toEqual(['// real'])
	})
})

describe('scanCss via extract (.css)', () => {
	it('counts block comments but not line markers', () => {
		const comments = extractFrom('a { color: red; } // not\n/* real */\n', '.css')
		expect(comments.map((c) => [c.text, c.startLine])).toEqual([['/* real */', 2]])
	})

	it('ignores comment markers inside strings', () => {
		expect(extractFrom('a::before { content: "/* x */"; }\n', '.css')).toEqual([])
	})

	it('handles an escaped quote inside a string', () => {
		const comments = extractFrom('a::before { content: "a\\"b"; } /* c */\n', '.css')
		expect(comments.map((c) => c.text)).toEqual(['/* c */'])
	})

	it('captures the line span of a multi-line comment', () => {
		const [comment] = extractFrom('/* a\nb\nc */\n', '.css')
		expect(comment).toMatchObject({ startLine: 1, endLine: 3, type: 'block' })
	})
})

describe('scanHtml via extract (.html)', () => {
	it('captures html comments with their line span and ignores other markers', () => {
		const comments = extractFrom('<!-- a\nb -->\n<p>// not</p>\n', '.html')
		expect(comments).toHaveLength(1)
		expect(comments[0]).toMatchObject({
			startLine: 1,
			endLine: 2,
			type: 'block',
			text: '<!-- a\nb -->',
		})
	})

	it('runs an unterminated html comment to the end of the source', () => {
		const [comment] = extractFrom('<!-- open', '.html')
		expect(comment).toMatchObject({ startLine: 1, endLine: 1, text: '<!-- open' })
	})
})

describe('commentLines', () => {
	it('sums the inclusive line spans of all comments', () => {
		expect(commentLines(extractFrom('// a\n/* b\nc */\n', '.ts'))).toBe(3)
		expect(commentLines([])).toBe(0)
	})
})
