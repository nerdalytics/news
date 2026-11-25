import { fetchFeed } from '../lib.mjs'

const ENDPOINT = 'https://www.chainguard.dev/api/rss'

export default () => fetchFeed(ENDPOINT)
