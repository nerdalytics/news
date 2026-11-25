import { fetchFeed } from '../lib.mjs'

const ENDPOINT = 'https://blog.sonatype.com/rss.xml'

export default () => fetchFeed(ENDPOINT)
