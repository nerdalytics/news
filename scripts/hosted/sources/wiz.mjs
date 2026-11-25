import { fetchFeed } from '../lib.mjs'

const ENDPOINT = 'https://www.wiz.io/blog/rss.xml'

export default () => fetchFeed(ENDPOINT)
