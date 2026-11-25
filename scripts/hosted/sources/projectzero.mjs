import { fetchFeed } from '../lib.mjs'

const ENDPOINT = 'https://googleprojectzero.blogspot.com/feeds/posts/default'

export default () => fetchFeed(ENDPOINT)
