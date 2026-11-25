import { fetchFeed } from '../lib.mjs'

const ENDPOINT = 'https://www.upwind.io/blog/rss-feed'

export default () => fetchFeed(ENDPOINT)
