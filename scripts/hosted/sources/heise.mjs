import { fetchFeed } from '../lib.mjs'

const ENDPOINT = 'https://www.heise.de/security/rss/news-atom.xml'

export default () => fetchFeed(ENDPOINT)
