import { fetchFeed } from '../lib.mjs'

const ENDPOINT = 'https://blog.trailofbits.com/feed/'

export default () => fetchFeed(ENDPOINT)
