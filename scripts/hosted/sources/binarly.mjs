import { fetchFeed } from '../lib.mjs'

const ENDPOINT = 'https://binarly.io/blog/rss.xml'

export default () => fetchFeed(ENDPOINT)
