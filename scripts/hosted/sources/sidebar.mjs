import { fetchFeed } from '../lib.mjs'

const ENDPOINT = 'https://sidebar.io/feed.xml'

export default () => fetchFeed(ENDPOINT)