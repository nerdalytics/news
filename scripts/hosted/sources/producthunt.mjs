import { getJson, LIMIT } from '../lib.mjs'

/**
 * Product Hunt's GraphQL API. It needs a developer token, which the workflow
 * passes in from the repository secret `PRODUCTHUNT_TOKEN`.
 */
const ENDPOINT = 'https://api.producthunt.com/v2/api/graphql'
const DAY_MS = 24 * 60 * 60 * 1000

const QUERY = `query TopPosts($after: DateTime!, $first: Int!) {
	posts(order: RANKING, postedAfter: $after, first: $first) {
		edges { node { id name tagline url website votesCount commentsCount createdAt } }
	}
}`

export default async function fetchItems() {
	const token = process.env.PRODUCTHUNT_TOKEN
	if (!token) throw new Error('The secret PRODUCTHUNT_TOKEN is not set')
	const variables = { after: new Date(Date.now() - DAY_MS).toISOString(), first: LIMIT }
	const { data, errors } = await getJson(ENDPOINT, {
		body: JSON.stringify({ query: QUERY, variables }),
		headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
		method: 'POST',
	})
	if (errors?.length) throw new Error(`Product Hunt answered: ${errors[0].message}`)
	return data.posts.edges.map(({ node }) => ({
		comments: { count: node.commentsCount, label: 'comment', url: node.url },
		description: node.tagline,
		id: node.id,
		score: { label: 'upvote', value: node.votesCount },
		time: Date.parse(node.createdAt),
		title: node.name,
		url: node.url,
	}))
}
