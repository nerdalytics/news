import { fetchFeed } from '../lib.mjs'

const ENDPOINT = 'https://www.hackthebox.com/blog/rss.xml'

export default () => fetchFeed(ENDPOINT)
