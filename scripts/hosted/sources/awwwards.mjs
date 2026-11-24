import { fetchFeed } from '../lib.mjs'

const ENDPOINT = 'http://feeds.feedburner.com/awwwards-sites-of-the-day'

export default () => fetchFeed(ENDPOINT)