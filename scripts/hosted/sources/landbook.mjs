import { fetchFeed } from '../lib.mjs'

const ENDPOINT = 'https://land-book.com/feed/'

export default () => fetchFeed(ENDPOINT)