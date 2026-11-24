import { fetchFeed } from '../lib.mjs'

const ENDPOINT = 'https://www.thisiscolossal.com/feed/'

export default () => fetchFeed(ENDPOINT)