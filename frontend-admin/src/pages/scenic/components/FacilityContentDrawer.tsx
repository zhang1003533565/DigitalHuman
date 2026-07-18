import { useEffect, useState } from 'react'
import {
  Alert,
  Button,
  Drawer,
  Form,
  Input,
  Radio,
  Select,
  Space,
  Switch,
  Tabs,
  Upload,
  message,
} from 'antd'
import { AudioOutlined, CameraOutlined, UploadOutlined, VideoCameraOutlined } from '@ant-design/icons'
import axios from 'axios'
import {
  getScenicFacilityContent,
  getScenicFacilityVoiceScriptCandidates,
  saveScenicFacilityContent,
  uploadScenicLiveVideo,
  type ScenicFacility,
  type ScenicFacilityContent,
  type ScenicFacilityVoiceScript,
} from '../../../api/scenic'
import { modelEmotionApi, type DigitalHumanModel } from '../../../api/modelEmotionApi'
import {
  publishVoiceScriptRecord,
  synthesizeVoiceScriptRecord,
  type VoiceScriptSynthesizePayload,
} from '../../../api/voiceScripts'
import {
  defaultVoiceSynthesisValues,
  speechPitchOptions,
  speechRateOptions,
  speechVolumeOptions,
  voiceOptions,
} from '../voiceSynthesisOptions'

type Props = {
  facility: ScenicFacility | null
  open: boolean
  onClose: () => void
  onSaved?: () => void | Promise<void>
}

type FacilityContentFormValues = ScenicFacilityContent & VoiceScriptSynthesizePayload

const emptyContent: FacilityContentFormValues = {
  architectureLandscapeParams: '',
  coreFunction: '',
  culturalConnotation: '',
  detailedIntroduction: '',
  highlights: '',
  performanceOpenInfo: '',
  visitorNotes: '',
  remark: '',
  audioEnabled: false,
  liveEnabled: false,
  defaultExperience: null,
  boundVoiceScriptId: null,
  liveSourceType: null,
  liveVideoUrl: '',
  liveStreamUrl: '',
  cameraStreamKey: '',
  liveDigitalHumanModelId: null,
  ...defaultVoiceSynthesisValues,
}

function voiceScriptErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data
    if (data && typeof data === 'object') {
      const record = data as { message?: unknown; error?: unknown; detail?: unknown }
      for (const candidate of [record.message, record.detail, record.error]) {
        if (typeof candidate === 'string' && candidate.trim()) return candidate
      }
    }
    if (typeof data === 'string' && data.trim()) return data
    if (error.code === 'ERR_NETWORK') return '无法连接后端服务，请确认 backend-java 已启动'
    return error.message || fallback
  }
  if (error instanceof Error && error.message) return error.message
  return fallback
}

function isFormValidationError(error: unknown): error is { errorFields?: unknown[] } {
  return typeof error === 'object' && error !== null && 'errorFields' in error
}

function isBindableScript(script: ScenicFacilityVoiceScript | null | undefined) {
  return script?.status === 'published' && script.audioStatus === 'ready' && Boolean(script.audioUrl?.trim())
}

function toAudioStatusLabel(script: ScenicFacilityVoiceScript) {
  if (script.audioStatus === 'ready') return '可试听'
  if (script.audioStatus === 'stale' || script.audioStatus === 'failed') return '需重合成'
  return '未合成'
}

function toScriptStatusLabel(script: ScenicFacilityVoiceScript) {
  if (script.status === 'published') return '已发布'
  if (script.status === 'archived') return '已归档'
  return '草稿'
}

function toScriptOptionLabel(script: ScenicFacilityVoiceScript) {
  return `${script.title} · v${script.versionNo} · ${toScriptStatusLabel(script)} · ${toAudioStatusLabel(script)}`
}

function toSynthesisValues(script: ScenicFacilityVoiceScript | null | undefined): VoiceScriptSynthesizePayload {
  return {
    voiceId: script?.voiceId || defaultVoiceSynthesisValues.voiceId,
    speechRate: script?.speechRate || defaultVoiceSynthesisValues.speechRate,
    speechVolume: script?.speechVolume || defaultVoiceSynthesisValues.speechVolume,
    speechPitch: script?.speechPitch || defaultVoiceSynthesisValues.speechPitch,
  }
}

function replaceScriptRecord(scripts: ScenicFacilityVoiceScript[], next: ScenicFacilityVoiceScript) {
  return scripts.map((script) => (script.id === next.id ? next : script))
}

function toFacilityContent(values: FacilityContentFormValues): ScenicFacilityContent {
  const { voiceId, speechRate, speechVolume, speechPitch, ...content } = values
  void voiceId
  void speechRate
  void speechVolume
  void speechPitch
  return content
}

function textArea(name: keyof ScenicFacilityContent, label: string, rows = 3) {
  return (
    <Form.Item name={name} label={label}>
      <Input.TextArea rows={rows} showCount maxLength={4000} />
    </Form.Item>
  )
}

export default function FacilityContentDrawer({ facility, open, onClose, onSaved }: Props) {
  const [form] = Form.useForm<FacilityContentFormValues>()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [checkingCamera, setCheckingCamera] = useState(false)
  const [synthesizing, setSynthesizing] = useState(false)
  const [publishingBinding, setPublishingBinding] = useState(false)
  const [videoPreviewError, setVideoPreviewError] = useState('')
  const [scripts, setScripts] = useState<ScenicFacilityVoiceScript[]>([])
  const [digitalHumanModels, setDigitalHumanModels] = useState<DigitalHumanModel[]>([])
  const [digitalHumanModelLoadError, setDigitalHumanModelLoadError] = useState('')
  const audioEnabled = Form.useWatch('audioEnabled', form) ?? false
  const selectedScriptId = Form.useWatch('boundVoiceScriptId', form)
  const liveEnabled = Form.useWatch('liveEnabled', form) ?? false
  const liveSourceType = Form.useWatch('liveSourceType', form)
  const liveVideoUrl = Form.useWatch('liveVideoUrl', form)?.trim()
  const selectedScript = scripts.find((script) => script.id === selectedScriptId) ?? null

  const loadVoiceScriptCandidates = async (facilityId: number) => {
    const voiceScripts = await getScenicFacilityVoiceScriptCandidates(facilityId)
    setScripts(voiceScripts)
    return voiceScripts
  }

  useEffect(() => {
    if (!open || !facility) return
    let active = true
    // eslint-disable-next-line react-hooks/set-state-in-effect -- opening a new facility starts a fresh remote load
    setLoading(true)
    Promise.allSettled([
      getScenicFacilityContent(facility.id),
      getScenicFacilityVoiceScriptCandidates(facility.id),
    ])
      .then((results) => {
        if (!active) return
        const [contentResult, voiceScriptsResult] = results
        if (contentResult.status !== 'fulfilled' || voiceScriptsResult.status !== 'fulfilled') {
          throw new Error('load facility content failed')
        }
        const content = contentResult.value
        const voiceScripts = voiceScriptsResult.value
        const selectedCandidate = voiceScripts.find((script) => script.id === content.boundVoiceScriptId) ?? null
        form.setFieldsValue({ ...emptyContent, ...content, ...toSynthesisValues(selectedCandidate) })
        setVideoPreviewError('')
        setScripts(voiceScripts)
        setDigitalHumanModelLoadError('')
      })
      .catch(() => message.error('加载景点内容配置失败'))
      .finally(() => active && setLoading(false))
    modelEmotionApi.getModels()
      .then((models) => {
        if (!active) return
        setDigitalHumanModels(models.filter((model) => model.status.toLowerCase() === 'active'))
        setDigitalHumanModelLoadError('')
      })
      .catch(() => {
        if (!active) return
        setDigitalHumanModels([])
        setDigitalHumanModelLoadError('数字人模型加载失败，直播配置暂不可用。')
      })
    return () => { active = false }
  }, [facility, form, open])

  const save = async () => {
    if (!facility) return
    try {
      const values = await form.validateFields()
      setSaving(true)
      await saveScenicFacilityContent(facility.id, toFacilityContent(values))
      message.success('内容配置已保存')
      await onSaved?.()
      onClose()
    } catch (error) {
      if (!isFormValidationError(error)) message.error(`保存内容配置失败：${voiceScriptErrorMessage(error, '请稍后重试')}`)
    } finally {
      setSaving(false)
    }
  }

  const syncSelectedScriptSynthesisValues = (scriptId: number | null | undefined, options = scripts) => {
    const script = options.find((item) => item.id === scriptId) ?? null
    form.setFieldsValue(toSynthesisValues(script))
  }

  const handleSynthesize = async () => {
    if (!facility || !selectedScript) {
      message.warning('请先选择一个口播版本')
      return
    }
    if (selectedScript.status === 'published') {
      message.warning('已发布版本不能直接重合成，请先回滚为新草稿')
      return
    }
    try {
      const values = await form.validateFields(['voiceId', 'speechRate', 'speechVolume', 'speechPitch'])
      setSynthesizing(true)
      const synthesized = await synthesizeVoiceScriptRecord(selectedScript.id, {
        voiceId: values.voiceId,
        speechRate: values.speechRate,
        speechVolume: values.speechVolume,
        speechPitch: values.speechPitch,
      })
      setScripts((current) => replaceScriptRecord(current, synthesized))
      syncSelectedScriptSynthesisValues(synthesized.id, replaceScriptRecord(scripts, synthesized))
      message.success('语音合成完成，可以试听')
    } catch (error) {
      if (isFormValidationError(error)) return
      message.error(`合成失败：${voiceScriptErrorMessage(error, '请检查语音服务配置')}`)
    } finally {
      setSynthesizing(false)
    }
  }

  const handlePublishAndBind = async () => {
    if (!facility || !selectedScript) {
      message.warning('请先选择一个口播版本')
      return
    }
    if (selectedScript.status !== 'draft' || selectedScript.audioStatus !== 'ready' || !selectedScript.audioUrl?.trim()) {
      message.warning('只有音频可用的草稿版本才能发布并绑定')
      return
    }
    try {
      setPublishingBinding(true)
      const published = await publishVoiceScriptRecord(selectedScript.id)
      const voiceScripts = await loadVoiceScriptCandidates(facility.id)
      form.setFieldValue('boundVoiceScriptId', published.id)
      syncSelectedScriptSynthesisValues(published.id, voiceScripts)
      const values = await form.validateFields()
      await saveScenicFacilityContent(facility.id, toFacilityContent(values))
      message.success('口播已发布并绑定到景点配置')
      await onSaved?.()
      onClose()
    } catch (error) {
      if (isFormValidationError(error)) return
      message.error(`发布并绑定失败：${voiceScriptErrorMessage(error, '请稍后重试')}`)
    } finally {
      setPublishingBinding(false)
    }
  }

  const checkCamera = async () => {
    setCheckingCamera(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      stream.getTracks().forEach((track) => track.stop())
      message.success('摄像头和麦克风权限正常')
    } catch {
      message.error('无法访问摄像头或麦克风')
    } finally {
      setCheckingCamera(false)
    }
  }

  const cultureTab = (
    <div className="facility-content__fields">
      {textArea('architectureLandscapeParams', '建筑/景观参数')}
      {textArea('coreFunction', '核心功能')}
      {textArea('culturalConnotation', '文化内涵', 4)}
      {textArea('detailedIntroduction', '详细介绍', 6)}
      {textArea('highlights', '游玩亮点', 4)}
      {textArea('performanceOpenInfo', '演艺/开放信息')}
      {textArea('visitorNotes', '游客须知')}
      {textArea('remark', '备注')}
    </div>
  )

  const audioTab = (
    <div className="facility-content__fields">
      <Form.Item name="audioEnabled" label="启用语音讲解" valuePropName="checked">
        <Switch />
      </Form.Item>
      <Form.Item
        name="boundVoiceScriptId"
        label="口播版本"
        rules={[{
          validator: (_, value) => {
            if (!audioEnabled) return Promise.resolve()
            if (!value) return Promise.reject(new Error('启用语音后必须绑定口播'))
            return isBindableScript(scripts.find((script) => script.id === value))
              ? Promise.resolve()
              : Promise.reject(new Error('请选择已发布且音频可用的口播，或先完成发布并绑定'))
          },
        }]}
      >
        <Select
          disabled={!audioEnabled}
          placeholder="选择管理版本；已发布版本可直接绑定，草稿可先合成再发布"
          options={scripts.map((script) => ({
            value: script.id,
            label: toScriptOptionLabel(script),
          }))}
          onChange={(value) => syncSelectedScriptSynthesisValues(value)}
          notFoundContent="暂无口播版本，请先在口播管理中创建草稿"
        />
      </Form.Item>
      {audioEnabled ? <Alert type="info" showIcon title="管理选择器会显示当前景点的全部版本；只有已发布且音频可用的版本才能最终绑定。" /> : null}
      {audioEnabled && selectedScript ? (
        <div className="facility-content__audio-quick-actions">
          <Alert
            type={selectedScript.status === 'published' ? 'info' : selectedScript.audioStatus === 'ready' ? 'success' : 'warning'}
            showIcon
            title={selectedScript.status === 'published'
              ? '当前版本已发布，如需调整音色或文本，请先在口播管理中回滚为新草稿。'
              : selectedScript.audioStatus === 'ready'
                ? '当前草稿已具备试听音频，可直接试听或执行发布并绑定。'
                : '当前草稿尚未具备可绑定音频，请先完成合成试听。'}
            description={`状态：${toScriptStatusLabel(selectedScript)}；音频状态：${selectedScript.audioStatus || 'missing'}；时长：${selectedScript.durationSec}秒`}
          />
          <Form.Item name="voiceId" label="音色" rules={[{ required: true, message: '请选择音色' }]}>
            <Select options={voiceOptions} disabled={selectedScript.status === 'published'} />
          </Form.Item>
          <Form.Item name="speechRate" label="语速">
            <Select options={speechRateOptions} disabled={selectedScript.status === 'published'} />
          </Form.Item>
          <Form.Item name="speechVolume" label="音量">
            <Select options={speechVolumeOptions} disabled={selectedScript.status === 'published'} />
          </Form.Item>
          <Form.Item name="speechPitch" label="语调">
            <Select options={speechPitchOptions} disabled={selectedScript.status === 'published'} />
          </Form.Item>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Space wrap>
              <Button
                icon={<AudioOutlined />}
                loading={synthesizing}
                disabled={selectedScript.status === 'published'}
                onClick={() => void handleSynthesize()}
              >
                合成试听
              </Button>
              <Button
                type="primary"
                loading={publishingBinding}
                disabled={selectedScript.status !== 'draft' || selectedScript.audioStatus !== 'ready' || !selectedScript.audioUrl?.trim()}
                onClick={() => void handlePublishAndBind()}
              >
                发布并绑定
              </Button>
            </Space>
            {selectedScript.audioUrl?.trim() ? <audio controls src={selectedScript.audioUrl} style={{ width: '100%' }} /> : null}
          </Space>
        </div>
      ) : null}
    </div>
  )

  const liveTab = (
    <div className="facility-content__fields">
      <Form.Item name="liveEnabled" label="启用直播" valuePropName="checked"><Switch /></Form.Item>
      <Form.Item
        name="liveDigitalHumanModelId"
        label="直播数字人"
        rules={[{ validator: (_, value) => !liveEnabled || value ? Promise.resolve() : Promise.reject(new Error('开启直播后必须选择直播数字人')) }]}
      >
        <Select
          disabled={!liveEnabled || Boolean(digitalHumanModelLoadError)}
          placeholder="选择当前景点直播使用的数字人"
          options={digitalHumanModels.map((model) => ({
            value: model.id,
            label: `${model.displayName || model.modelKey} · ${model.modelKey}`,
          }))}
          notFoundContent="暂无可用数字人，请先到数字人动作配置扫描模型"
        />
      </Form.Item>
      {liveEnabled && digitalHumanModelLoadError ? (
        <Alert type="warning" showIcon title={digitalHumanModelLoadError} />
      ) : null}
      {liveEnabled && !digitalHumanModelLoadError && digitalHumanModels.length === 0 ? (
        <Alert type="warning" showIcon title="暂无启用的数字人模型，无法开启景点直播。" />
      ) : null}
      <Form.Item
        name="liveSourceType"
        label="直播来源"
        rules={[{ validator: (_, value) => !liveEnabled || value ? Promise.resolve() : Promise.reject(new Error('请选择直播来源')) }]}
      >
        <Radio.Group disabled={!liveEnabled} optionType="button" buttonStyle="solid">
          <Radio.Button value="video"><VideoCameraOutlined /> 上传视频</Radio.Button>
          <Radio.Button value="stream"><AudioOutlined /> 播放流</Radio.Button>
          <Radio.Button value="camera"><CameraOutlined /> 摄像头推流</Radio.Button>
        </Radio.Group>
      </Form.Item>
      {liveEnabled && liveSourceType === 'video' ? (
        <>
          <Form.Item
            name="liveVideoUrl"
            label="视频地址"
            rules={[{ required: true, message: '开启直播后必须上传视频' }]}
          ><Input
            placeholder="上传视频后自动填写，也可使用已有视频地址"
            onChange={() => setVideoPreviewError('')}
          /></Form.Item>
          <Upload
            accept="video/*"
            showUploadList={false}
            beforeUpload={async (file) => {
              setUploading(true)
              try {
                const result = await uploadScenicLiveVideo(file as File)
                form.setFieldValue('liveVideoUrl', result.url)
                setVideoPreviewError('')
                message.success('视频上传成功')
              } catch { message.error('视频上传失败') } finally { setUploading(false) }
              return false
            }}
          ><Button icon={<UploadOutlined />} loading={uploading}>上传视频文件</Button></Upload>
          {liveVideoUrl ? (
            <div className="facility-content__video-preview">
              <strong>视频预览</strong>
              <video
                key={liveVideoUrl}
                controls
                preload="metadata"
                src={liveVideoUrl}
                onLoadedData={() => setVideoPreviewError('')}
                onError={() => setVideoPreviewError('视频无法播放，请检查地址、文件格式或重新上传。')}
              >当前浏览器不支持视频播放。</video>
              {videoPreviewError ? <Alert type="error" showIcon title={videoPreviewError} /> : null}
            </div>
          ) : null}
        </>
      ) : null}
      {liveEnabled && liveSourceType === 'stream' ? (
        <Form.Item name="liveStreamUrl" label="播放流地址" rules={[{ required: true, message: '请填写直播流地址' }]}>
          <Input placeholder="https:// 或可播放的直播流地址" />
        </Form.Item>
      ) : null}
      {liveEnabled && liveSourceType === 'camera' ? (
        <>
          <Form.Item name="cameraStreamKey" label="摄像头推流通道" rules={[{ required: true, message: '摄像头推流必须配置推流通道' }]}>
            <Input placeholder="例如 lingshan-camera-01" />
          </Form.Item>
          <Button icon={<CameraOutlined />} loading={checkingCamera} onClick={() => void checkCamera()}>检测摄像头权限</Button>
          <Alert type="warning" showIcon title="权限检测不等于已开播，正式直播仍需要 WebRTC 或直播网关。" />
        </>
      ) : null}
      {(audioEnabled || liveEnabled) ? (
        <Form.Item name="defaultExperience" label="游客端默认入口">
          <Radio.Group>
            <Radio value="audio" disabled={!audioEnabled}>语音讲解</Radio>
            <Radio value="live" disabled={!liveEnabled}>直播</Radio>
          </Radio.Group>
        </Form.Item>
      ) : null}
    </div>
  )

  return (
    <Drawer
      title={facility ? `${facility.name} · 内容配置` : '内容配置'}
      open={open}
      size={760}
      onClose={onClose}
      forceRender
      extra={<Space><Button onClick={onClose}>取消</Button><Button type="primary" loading={saving} onClick={() => void save()}>保存配置</Button></Space>}
    >
      <style>{styles}</style>
      <Form form={form} layout="vertical" disabled={loading} initialValues={emptyContent}>
        <Tabs items={[
          { key: 'culture', label: '文化资料', children: cultureTab },
          { key: 'audio', label: '口播语音', children: audioTab },
          { key: 'live', label: '直播配置', children: liveTab },
        ]} />
      </Form>
    </Drawer>
  )
}

const styles = `
.facility-content__fields { max-width: 700px; padding: 8px 2px 24px; }
.facility-content__fields .ant-alert { margin-top: 14px; }
.facility-content__fields .ant-upload-wrapper { display: block; margin-top: -12px; margin-bottom: 18px; }
.facility-content__video-preview { display: grid; gap: 10px; margin-bottom: 20px; }
.facility-content__video-preview video { display: block; width: 100%; max-height: 360px; border: 1px solid #d9d9d9; border-radius: 6px; background: #080f19; }
.facility-content__video-preview .ant-alert { margin-top: 0; }
`
