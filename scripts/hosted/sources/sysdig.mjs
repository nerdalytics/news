import { fetchFeed } from '../lib.mjs'

const ENDPOINT = 'https://sysdig.com/feed/'

export default () => fetchFeed(ENDPOINT)
