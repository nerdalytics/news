import { fetchFeed } from '../lib.mjs'

const ENDPOINT = 'https://www.mend.io/blog/feed/'

export default () => fetchFeed(ENDPOINT)
