import axios from 'axios'

export type RuntimeMapConfig = {
  amapKey: string
  amapSecurityKey: string
  configured: boolean
}

export async function loadMapConfig() {
  const response = await axios.get<RuntimeMapConfig>('/api/app/map-config')
  return response.data
}
