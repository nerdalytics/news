import { defineConfig } from 'vitest/config'

const buildId = process.env.GITHUB_SHA?.slice(0, 12) ?? `local-${Date.now()}`
const repository = process.env.GITHUB_REPOSITORY ?? 'nerdalytics/news'

export default defineConfig({
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
