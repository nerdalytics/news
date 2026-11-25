import { fetchFeed } from '../lib.mjs'

const ENDPOINT = 'https://www.grahamcluley.com/feed/'

export default () => fetchFeed(ENDPOINT)
