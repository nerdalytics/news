import { fetchFeed } from '../lib.mjs'

const ENDPOINT = 'https://www.vulncheck.com/feed/blog/atom.xml'

export default () => fetchFeed(ENDPOINT)
