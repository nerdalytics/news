import { fetchFeed } from '../lib.mjs'

const ENDPOINT = 'https://www.siteinspire.com/websites/feed'

export default () => fetchFeed(ENDPOINT)