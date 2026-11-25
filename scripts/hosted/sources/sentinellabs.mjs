import { fetchFeed } from '../lib.mjs'

const ENDPOINT = 'https://www.sentinelone.com/labs/feed/'

export default () => fetchFeed(ENDPOINT)
