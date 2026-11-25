import { fetchFeed } from '../lib.mjs'

const ENDPOINT = 'https://www.endorlabs.com/blog/rss.xml'

export default () => fetchFeed(ENDPOINT)
