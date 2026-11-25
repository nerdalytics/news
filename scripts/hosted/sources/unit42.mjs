import { fetchFeed } from '../lib.mjs'

const ENDPOINT = 'https://unit42.paloaltonetworks.com/feed/'

export default () => fetchFeed(ENDPOINT)
