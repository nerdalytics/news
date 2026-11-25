import { fetchFeed } from '../lib.mjs'

const ENDPOINT = 'https://feeds.feedburner.com/TheHackersNews'

export default () => fetchFeed(ENDPOINT)
