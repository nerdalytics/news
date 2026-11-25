import { fetchFeed } from '../lib.mjs'

const ENDPOINT = 'https://www.schneier.com/feed/atom'

export default () => fetchFeed(ENDPOINT)
