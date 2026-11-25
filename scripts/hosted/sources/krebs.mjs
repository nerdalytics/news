import { fetchFeed } from '../lib.mjs'

const ENDPOINT = 'https://krebsonsecurity.com/feed/'

export default () => fetchFeed(ENDPOINT)
