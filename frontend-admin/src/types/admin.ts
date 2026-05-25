export type LoginResult = {
  userId: number
  username: string
  displayName: string
  role: 'ADMIN' | 'REVIEWER' | 'KNOWLEDGE_ADMIN' | 'OBSERVER' | 'USER'
  token: string
}
