import { fetchFeed } from '../lib.mjs'

const ENDPOINT = 'https://aws.amazon.com/blogs/security/feed/'

export default () => fetchFeed(ENDPOINT)
