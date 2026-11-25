import { fetchFeed } from '../lib.mjs'

const ENDPOINT = 'https://www.microsoft.com/security/blog/feed/'

export default () => fetchFeed(ENDPOINT)
