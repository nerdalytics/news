import { fetchFeed } from '../lib.mjs'

const ENDPOINT = 'https://socket.dev/api/blog/feed.atom'

export default () => fetchFeed(ENDPOINT)
