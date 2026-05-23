import { Button, Card, Form, Input, Tag } from 'antd'
import type { FormInstance } from 'antd'

type AdminModelSettings = {
  embeddingModel: string
  speechModel: string
  visionModel: string
  chatModel: string
  multimodalModel: string
}

type VisionOption = {
  value: string
  provider?: string
}

type VisionConfigPageProps = {
  form: FormInstance<AdminModelSettings>
  loading: boolean
  saving: boolean
  testing: boolean
  options: VisionOption[]
  onSave: () => void
  onTest: () => void
  result: React.ReactNode
}

export default function VisionConfigPage({
  form,
  loading,
  saving,
  testing,
  options,
  onSave,
  onTest,
  result,
}: VisionConfigPageProps) {
  const selectedModel = Form.useWatch('visionModel', form)
  const currentOption = options.find((item) => item.value === selectedModel)

  return (
    <div className="admin-form-grid">
      <div className="admin-two-column admin-embedding-layout">
        <Card title="视觉模型列表" className="admin-settings-panel-card">
          <div className="admin-form-grid">
            <Input placeholder="搜索视觉模型名称或标识" disabled />
            <div className="admin-embedding-list">
              {options.length ? options.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={`admin-embedding-item ${item.value === selectedModel ? 'admin-embedding-item--active' : ''}`}
                  onClick={() => form.setFieldValue('visionModel', item.value)}
                >
                  <div className="admin-embedding-item__title">{item.value}</div>
                  <div className="admin-embedding-item__meta">
                    <span>提供方：{item.provider ?? '未标注'}</span>
                    {item.value === selectedModel ? <Tag color="blue">当前候选</Tag> : null}
                  </div>
                </button>
              )) : (
                <div className="admin-empty-state">
                  <strong>暂无视觉模型</strong>
                  <div>请先到“手动维护”里添加视觉模型。</div>
                </div>
              )}
            </div>
          </div>
        </Card>
        <Card title="模型配置" className="admin-settings-panel-card">
          <div className="admin-form-grid">
            <div className="admin-inline-meta">
              <Tag color={selectedModel ? 'green' : 'default'}>{selectedModel ? '已选择模型' : '未选择模型'}</Tag>
              {currentOption?.provider ? <Tag>{currentOption.provider}</Tag> : null}
            </div>
            <Form form={form} layout="vertical" disabled={loading}>
              <Form.Item
                label="视觉模型"
                name="visionModel"
                rules={[{ required: true, message: '请选择视觉模型' }]}
                extra="用于图片理解、景区识别和视觉问答。"
              >
                <Input placeholder="请选择或输入视觉模型" />
              </Form.Item>
            </Form>
            <div className="admin-action-row">
              <Button type="primary" onClick={onSave} loading={saving}>
                保存设置
              </Button>
              <Button onClick={onTest} loading={testing}>
                测试当前模型
              </Button>
              <Button onClick={() => form.resetFields(['visionModel'])} disabled={saving || loading}>
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
