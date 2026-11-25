import { fetchFeed } from '../lib.mjs'

const ENDPOINT = 'https://github.blog/security/feed/'

export default () => fetchFeed(ENDPOINT)
