import { defineConfig } from 'vitest/config'

/** Changes with every build. The running page compares it with `version.json` to find out about updates. */
const buildId = process.env.GITHUB_SHA?.slice(0, 12) ?? `local-${Date.now()}`
/** The repository whose workflows publish the hosted feeds. A fork reads its own feeds. */
const repository = process.env.GITHUB_REPOSITORY ?? 'nerdalytics/tureel'

export default defineConfig({
	// A relative base lets the same build run under /tureel/ on GitHub Pages
	// and at the root of a custom domain.
	base: './',
	build: {
		target: 'es2023',
	},
	define: {
		__BUILD_ID__: JSON.stringify(buildId),
		__REPOSITORY__: JSON.stringify(repository),
	},
	plugins: [
		{
			name: 'version-file',
			generateBundle() {
				this.emitFile({
					fileName: 'version.json',
					source: JSON.stringify({ build: buildId }),
					type: 'asset',
				})
			},
		},
	],
	test: {
		environment: 'jsdom',
		include: ['test/**/*.test.ts'],
	},
})
