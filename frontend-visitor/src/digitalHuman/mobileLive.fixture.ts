import { getMobileLiveComments } from './mobileLive.js'

const readonlyMessages = [
  { id: '1' },
  { id: '2' },
] as const

getMobileLiveComments(readonlyMessages, null)
