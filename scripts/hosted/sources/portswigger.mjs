import { fetchFeed } from '../lib.mjs'

const ENDPOINT = 'https://portswigger.net/research/rss'

export default () => fetchFeed(ENDPOINT)
