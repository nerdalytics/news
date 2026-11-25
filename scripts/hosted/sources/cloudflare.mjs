import { fetchFeed } from '../lib.mjs'

const ENDPOINT = 'https://blog.cloudflare.com/rss/'

export default () => fetchFeed(ENDPOINT)
