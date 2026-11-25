import { fetchFeed } from '../lib.mjs'

const ENDPOINT = 'https://www.aikido.dev/blog/rss.xml'

export default () => fetchFeed(ENDPOINT)
