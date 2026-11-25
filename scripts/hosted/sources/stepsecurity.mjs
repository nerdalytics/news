import { fetchFeed } from '../lib.mjs'

const ENDPOINT = 'https://www.stepsecurity.io/blog/rss.xml'

export default () => fetchFeed(ENDPOINT)
