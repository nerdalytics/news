import { fetchFeed } from '../lib.mjs'

const ENDPOINT = 'https://www.bleepingcomputer.com/feed/'

export default () => fetchFeed(ENDPOINT)
