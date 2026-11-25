import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
	vi.unstubAllGlobals()
})

function stubJson(payload: unknown) {
	const fetchMock = vi.fn(async (_url: string, _init: { headers?: Record<string, string> }) => ({
		ok: true,
		json: async () => payload,
	}))
	vi.stubGlobal('fetch', fetchMock)
	return fetchMock
}

async function load(id: string) {
	const { default: fetchItems } = await import(`../scripts/hosted/sources/${id}.mjs`)
	return fetchItems()
}

describe('hosted JSON probes', () => {
	it('ghadvisories maps GitHub global advisories', async () => {
		const fetchMock = stubJson([
			{
				ghsa_id: 'GHSA-1',
				summary: 'A flaw',
				html_url: 'https://github.com/advisories/GHSA-1',
				published_at: '2026-11-20T00:00:00Z',
				severity: 'high',
			},
		])
		const items = await load('ghadvisories')
		const call = fetchMock.mock.calls[0]
		expect(call?.[0]).toBe('https://api.github.com/advisories?per_page=20')
		expect(call?.[1]?.headers).toMatchObject({ Accept: 'application/json' })
		expect(items).toEqual([
			{
				id: 'GHSA-1',
				title: 'A flaw',
				url: 'https://github.com/advisories/GHSA-1',
				time: Date.parse('2026-11-20T00:00:00Z'),
				tag: 'high',
			},
		])
	})

	it('cisakev sorts the catalog newest first and links each CVE', async () => {
		stubJson({
			vulnerabilities: [
				{
					cveID: 'CVE-2026-1',
					vulnerabilityName: 'Old',
					dateAdded: '2026-11-01',
					shortDescription: 'old desc',
				},
				{
					cveID: 'CVE-2026-2',
					vulnerabilityName: 'New',
					dateAdded: '2026-11-20',
					shortDescription: 'new desc',
				},
			],
		})
		const items = await load('cisakev')
		expect(items.map((item: { id: string }) => item.id)).toEqual(['CVE-2026-2', 'CVE-2026-1'])
		expect(items[0]).toEqual({
			id: 'CVE-2026-2',
			title: 'CVE-2026-2: New',
			url: 'https://nvd.nist.gov/vuln/detail/CVE-2026-2',
			time: Date.parse('2026-11-20'),
			description: 'new desc',
		})
	})

	it('hibp sorts breaches newest first', async () => {
		stubJson([
			{ Name: 'Old', Title: 'Old Site', AddedDate: '2026-11-01T00:00:00Z' },
			{ Name: 'New', Title: 'New Site', AddedDate: '2026-11-20T00:00:00Z' },
		])
		const items = await load('hibp')
		expect(items.map((item: { id: string }) => item.id)).toEqual(['New', 'Old'])
		expect(items[0]).toEqual({
			id: 'New',
			title: 'New Site breach',
			url: 'https://haveibeenpwned.com/PwnedWebsites#New',
			time: Date.parse('2026-11-20T00:00:00Z'),
		})
	})
})
