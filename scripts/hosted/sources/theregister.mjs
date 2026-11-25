import { fetchFeed } from '../lib.mjs'

const ENDPOINT = 'https://www.theregister.com/security/headlines.atom'

export default () => fetchFeed(ENDPOINT)
