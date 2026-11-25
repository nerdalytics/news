import { fetchFeed } from '../lib.mjs'

const ENDPOINT = 'https://bishopfox.com/blog/rss.xml'

export default () => fetchFeed(ENDPOINT)
