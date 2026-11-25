import { fetchFeed } from '../lib.mjs'

const ENDPOINT = 'https://blog.gitguardian.com/rss/'

export default () => fetchFeed(ENDPOINT)
