import { fetchFeed } from '../lib.mjs'

const ENDPOINT = 'https://blog.talosintelligence.com/rss/'

export default () => fetchFeed(ENDPOINT)
