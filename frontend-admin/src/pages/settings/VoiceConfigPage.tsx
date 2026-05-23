import { Button, Card, Form, Input, Tag } from 'antd'
import type { FormInstance } from 'antd'

type AdminModelSettings = {
  embeddingModel: string
  speechModel: string
  visionModel: string
  chatModel: string
  multimodalModel: string
}

type SpeechTestForm = {
  speechTestText: string
}

type VoiceOption = {
  value: string
  label: string
}

type VoiceConfigPageProps = {
  form: FormInstance<AdminModelSettings>
  speechTestForm: FormInstance<SpeechTestForm>
  loading: boolean
  saving: boolean
  testing: boolean
  options: VoiceOption[]
  onSave: () => void
  onTest: () => void
  onReset: () => void
  result: React.ReactNode
}

function buildVoiceMeta(shortName: string) {
  const parts = shortName.split('-')
  const locale = parts.slice(0, 2).join('-')
  const rawName = parts.slice(2).join('-').replace('Neural', '')
  const localeLabelMap: Record<string, string> = {
    'zh-CN': '中文',
    'zh-HK': '中文（香港）',
    'zh-TW': '中文（台湾）',
    'en-US': '英文',
    'ja-JP': '日文',
    'ko-KR': '韩文',
  }

  return {
    localeLabel: localeLabelMap[locale] ?? locale,
    displayName: rawName || shortName,
  }
}

export default function VoiceConfigPage({
  form,
  speechTestForm,
  loading,
  saving,
  testing,
  options,
  onSave,
  onTest,
  onReset,
  result,
}: VoiceConfigPageProps) {
  const selectedVoice = Form.useWatch('speechModel', form)
  const currentOption = options.find((item) => item.value === selectedVoice)

  return (
    <div className="admin-form-grid">
      <div className="admin-two-column admin-embedding-layout">
        <Card title="语音音色列表" className="admin-settings-panel-card">
          <div className="admin-form-grid">
            <Input placeholder="搜索音色名称" disabled />
            <div className="admin-embedding-list">
              {options.length ? options.map((item) => {
                const meta = buildVoiceMeta(item.value)
                return (
                  <button
                    key={item.value}
                    type="button"
                    className={`admin-embedding-item ${item.value === selectedVoice ? 'admin-embedding-item--active' : ''}`}
                    onClick={() => form.setFieldValue('speechModel', item.value)}
                  >
                    <div className="admin-embedding-item__title">{meta.localeLabel}-{meta.displayName}</div>
                    <div className="admin-embedding-item__meta">
                      <span>{item.value}</span>
                      {item.value === selectedVoice ? <Tag color="blue">当前使用</Tag> : null}
                    </div>
                  </button>
                )
              }) : (
                <div className="admin-empty-state">
                  <strong>暂无可用音色</strong>
                  <div>请检查本地 edge-tts 环境是否正常。</div>
                </div>
              )}
            </div>
          </div>
        </Card>
        <Card title="音色配置" className="admin-settings-panel-card">
          <div className="admin-form-grid">
            <div className="admin-inline-meta">
              <Tag color={selectedVoice ? 'green' : 'default'}>{selectedVoice ? '已选择音色' : '未选择音色'}</Tag>
              {currentOption ? <Tag>Local TTS</Tag> : null}
            </div>
            <Form form={form} layout="vertical" disabled={loading}>
              <Form.Item
                label="语音音色"
                name="speechModel"
                rules={[{ required: true, message: '请选择语音音色' }]}
                extra="当前这里接的是本地 edge-tts 能力，会直接展示本机环境真实支持的微软 voice 列表。"
              >
                <Input placeholder="请选择语音音色" />
              </Form.Item>
            </Form>
            <Form form={speechTestForm} layout="vertical">
              <Form.Item
                label="测试文本"
                name="speechTestText"
                rules={[{ required: true, message: '请输入测试文本' }]}
                extra="点击“测试当前音色”时，会用这里的内容做一次本地语音合成测试。"
              >
                <Input.TextArea rows={5} placeholder="请输入您想试听的文字内容" maxLength={200} showCount />
              </Form.Item>
            </Form>
            <div className="admin-action-row">
              <Button type="primary" onClick={onSave} loading={saving}>
                保存设置
              </Button>
              <Button onClick={onTest} loading={testing}>
                测试当前音色
              </Button>
              <Button onClick={onReset} disabled={saving || loading}>
                重置表单
              </Button>
            </div>
            {result}
          </div>
        </Card>
      </div>
    </div>
  )
}
