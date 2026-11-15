import { defineConfig } from 'vitest/config'

export default defineConfig({
	// Relative base: the same build works under /tureel/ on GitHub Pages
	// and at the root of a custom domain.
	base: './',
	build: {
		target: 'es2023',
	},
	test: {
		environment: 'jsdom',
		include: ['test/**/*.test.ts'],
	},
})
