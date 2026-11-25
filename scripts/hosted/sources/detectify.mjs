import { fetchFeed } from '../lib.mjs'

const ENDPOINT = 'https://blog.detectify.com/feed/'

export default () => fetchFeed(ENDPOINT)
