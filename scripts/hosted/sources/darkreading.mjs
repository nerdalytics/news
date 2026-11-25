import { fetchFeed } from '../lib.mjs'

const ENDPOINT = 'https://www.darkreading.com/rss.xml'

export default () => fetchFeed(ENDPOINT)
