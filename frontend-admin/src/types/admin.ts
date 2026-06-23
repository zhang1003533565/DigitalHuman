export type LoginResult = {
  userId: number
  username: string
  displayName: string
  role: 'ADMIN' | 'OBSERVER' | 'USER'
  token: string
}
