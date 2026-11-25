import { fetchFeed } from '../lib.mjs'

const ENDPOINT = 'https://snyk.io/blog/feed/'

export default () => fetchFeed(ENDPOINT)
