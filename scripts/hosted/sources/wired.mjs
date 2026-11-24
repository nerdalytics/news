import { fetchFeed } from '../lib.mjs'

const ENDPOINT = 'https://www.wired.com/feed/rss'

export default () => fetchFeed(ENDPOINT)