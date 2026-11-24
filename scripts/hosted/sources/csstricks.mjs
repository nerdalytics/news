import { fetchFeed } from '../lib.mjs'

const ENDPOINT = 'http://feeds.feedburner.com/CssTricks'

export default () => fetchFeed(ENDPOINT)