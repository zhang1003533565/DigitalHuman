import type { VoiceScriptSynthesizePayload } from '../../api/voiceScripts'

export const voiceOptions = [
  { value: 'zh-CN-XiaoxiaoNeural', label: '晓晓（自然亲和）' },
  { value: 'zh-CN-YunxiNeural', label: '云希（成熟稳重）' },
  { value: 'zh-CN-XiaoyiNeural', label: '晓伊（温柔清晰）' },
  { value: 'zh-CN-YunjianNeural', label: '云健（沉稳有力）' },
]

export const speechRateOptions = [
  { value: '-20%', label: '慢速（-20%）' },
  { value: '+0%', label: '标准（+0%）' },
  { value: '+20%', label: '快速（+20%）' },
]

export const speechVolumeOptions = [
  { value: '-20%', label: '较轻（-20%）' },
  { value: '+0%', label: '标准（+0%）' },
  { value: '+20%', label: '较响（+20%）' },
]

export const speechPitchOptions = [
  { value: '-10Hz', label: '偏低（-10Hz）' },
  { value: '+0Hz', label: '标准（+0Hz）' },
  { value: '+10Hz', label: '偏高（+10Hz）' },
]

export const defaultVoiceSynthesisValues: VoiceScriptSynthesizePayload = {
  voiceId: 'zh-CN-XiaoxiaoNeural',
  speechRate: '+0%',
  speechVolume: '+0%',
  speechPitch: '+0Hz',
}
