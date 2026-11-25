import { fetchFeed } from '../lib.mjs'

const ENDPOINT = 'https://blog.doyensec.com/atom.xml'

export default () => fetchFeed(ENDPOINT)
