import { fetchFeed } from '../lib.mjs'

const ENDPOINT = 'https://rss.golem.de/rss.php?feed=RSS2.0'

export default () => fetchFeed(ENDPOINT)
