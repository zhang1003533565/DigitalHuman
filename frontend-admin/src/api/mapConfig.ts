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

export async function saveMapConfig(payload: Pick<RuntimeMapConfig, 'amapKey' | 'amapSecurityKey'>) {
  const response = await axios.put<RuntimeMapConfig>('/api/admin/settings/map-config', payload)
  return response.data
}
