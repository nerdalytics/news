import { fetchFeed } from '../lib.mjs'

const ENDPOINT = 'https://www.cisa.gov/cybersecurity-advisories/all.xml'

export default () => fetchFeed(ENDPOINT)
