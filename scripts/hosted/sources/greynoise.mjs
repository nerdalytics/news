import { fetchFeed } from '../lib.mjs'

const ENDPOINT = 'https://www.greynoise.io/blog/rss.xml'

export default () => fetchFeed(ENDPOINT)
