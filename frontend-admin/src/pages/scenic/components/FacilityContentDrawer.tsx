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
import {
  getScenicFacilityContent,
  getScenicFacilityVoiceScripts,
  saveScenicFacilityContent,
  uploadScenicLiveVideo,
  type ScenicFacility,
  type ScenicFacilityContent,
  type ScenicFacilityVoiceScript,
} from '../../../api/scenic'

type Props = {
  facility: ScenicFacility | null
  open: boolean
  onClose: () => void
  onSaved?: () => void | Promise<void>
}

const emptyContent: ScenicFacilityContent = {
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
}

function textArea(name: keyof ScenicFacilityContent, label: string, rows = 3) {
  return (
    <Form.Item name={name} label={label}>
      <Input.TextArea rows={rows} showCount maxLength={4000} />
    </Form.Item>
  )
}

export default function FacilityContentDrawer({ facility, open, onClose, onSaved }: Props) {
  const [form] = Form.useForm<ScenicFacilityContent>()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [checkingCamera, setCheckingCamera] = useState(false)
  const [scripts, setScripts] = useState<ScenicFacilityVoiceScript[]>([])
  const audioEnabled = Form.useWatch('audioEnabled', form) ?? false
  const liveEnabled = Form.useWatch('liveEnabled', form) ?? false
  const liveSourceType = Form.useWatch('liveSourceType', form)

  useEffect(() => {
    if (!open || !facility) return
    let active = true
    // eslint-disable-next-line react-hooks/set-state-in-effect -- opening a new facility starts a fresh remote load
    setLoading(true)
    Promise.all([getScenicFacilityContent(facility.id), getScenicFacilityVoiceScripts(facility.id)])
      .then(([content, voiceScripts]) => {
        if (!active) return
        form.setFieldsValue({ ...emptyContent, ...content })
        setScripts(voiceScripts)
      })
      .catch(() => message.error('加载景点内容配置失败'))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [facility, form, open])

  const save = async () => {
    if (!facility) return
    try {
      const values = await form.validateFields()
      setSaving(true)
      await saveScenicFacilityContent(facility.id, values)
      message.success('内容配置已保存')
      await onSaved?.()
      onClose()
    } catch (error) {
      if (!(error as { errorFields?: unknown[] })?.errorFields) message.error('保存内容配置失败')
    } finally {
      setSaving(false)
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
        label="绑定已发布口播"
        rules={[{ validator: (_, value) => !audioEnabled || value ? Promise.resolve() : Promise.reject(new Error('启用语音后必须绑定口播')) }]}
      >
        <Select
          disabled={!audioEnabled}
          placeholder="选择已发布且音频可用的口播"
          options={scripts.map((script) => ({
            value: script.id,
            label: `${script.title} · v${script.versionNo} · ${script.durationSec}秒`,
          }))}
          notFoundContent="暂无可绑定口播，请先在口播管理中合成并发布"
        />
      </Form.Item>
      {audioEnabled ? <Alert type="info" showIcon title="这里只显示属于当前正式景点、已发布且音频可用的口播。" /> : null}
    </div>
  )

  const liveTab = (
    <div className="facility-content__fields">
      <Form.Item name="liveEnabled" label="启用直播" valuePropName="checked"><Switch /></Form.Item>
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
          ><Input placeholder="上传视频后自动填写，也可使用已有视频地址" /></Form.Item>
          <Upload
            accept="video/*"
            showUploadList={false}
            beforeUpload={async (file) => {
              setUploading(true)
              try {
                const result = await uploadScenicLiveVideo(file as File)
                form.setFieldValue('liveVideoUrl', result.url)
                message.success('视频上传成功')
              } catch { message.error('视频上传失败') } finally { setUploading(false) }
              return false
            }}
          ><Button icon={<UploadOutlined />} loading={uploading}>上传视频文件</Button></Upload>
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
`
