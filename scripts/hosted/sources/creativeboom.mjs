import { fetchFeed } from '../lib.mjs'

const ENDPOINT = 'https://www.creativeboom.com/feed/'

export default () => fetchFeed(ENDPOINT)