import { fetchFeed } from '../lib.mjs'

const ENDPOINT = 'https://www.booooooom.com/feed/'

export default () => fetchFeed(ENDPOINT)