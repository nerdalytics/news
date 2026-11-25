import { fetchFeed } from '../lib.mjs'

const ENDPOINT = 'https://www.troyhunt.com/rss/'

export default () => fetchFeed(ENDPOINT)
