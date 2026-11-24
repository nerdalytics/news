import { fetchFeed } from '../lib.mjs'

const ENDPOINT = 'https://techcrunch.com/feed/'

export default () => fetchFeed(ENDPOINT)