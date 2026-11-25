import { fetchFeed } from '../lib.mjs'

const ENDPOINT = 'https://www.huntress.com/blog/rss.xml'

export default () => fetchFeed(ENDPOINT)
