import { fetchFeed } from '../lib.mjs'

const ENDPOINT = 'https://isc.sans.edu/rssfeed_full.xml'

export default () => fetchFeed(ENDPOINT)
