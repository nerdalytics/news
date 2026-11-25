import { fetchFeed } from '../lib.mjs'

const ENDPOINT = 'https://rustsec.org/feed.xml'

export default () => fetchFeed(ENDPOINT)
