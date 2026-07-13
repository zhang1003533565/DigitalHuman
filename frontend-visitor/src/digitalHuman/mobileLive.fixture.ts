import { getRecentMobileLiveComments } from './mobileLive.js'

const readonlyMessages = [
  { id: '1' },
  { id: '2' },
] as const

getRecentMobileLiveComments(readonlyMessages)
