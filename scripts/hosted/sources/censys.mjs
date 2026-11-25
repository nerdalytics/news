import { fetchFeed } from '../lib.mjs'

const ENDPOINT = 'https://censys.com/feed/'

export default () => fetchFeed(ENDPOINT)
