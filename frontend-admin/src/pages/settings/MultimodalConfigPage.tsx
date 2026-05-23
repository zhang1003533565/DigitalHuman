import { Button, Card, Form, Input, Tag } from 'antd'
import type { FormInstance } from 'antd'

type AdminModelSettings = {
  embeddingModel: string
  speechModel: string
  visionModel: string
  chatModel: string
  multimodalModel: string
}

type MultimodalOption = {
  value: string
  provider?: string
}

type MultimodalConfigPageProps = {
  form: FormInstance<AdminModelSettings>
  loading: boolean
  saving: boolean
  testing: boolean
  options: MultimodalOption[]
  onSave: () => void
  onTest: () => void
  result: React.ReactNode
}

export default function MultimodalConfigPage({
  form,
  loading,
  saving,
  testing,
  options,
  onSave,
  onTest,
  result,
}: MultimodalConfigPageProps) {
  const selectedModel = Form.useWatch('multimodalModel', form)
  const currentOption = options.find((item) => item.value === selectedModel)

  return (
    <div className="admin-form-grid">
      <div className="admin-two-column admin-embedding-layout">
        <Card title="多模态模型列表" className="admin-settings-panel-card">
          <div className="admin-form-grid">
            <Input placeholder="搜索模型名称或标识" disabled />
            <div className="admin-embedding-list">
              {options.length ? options.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={`admin-embedding-item ${item.value === selectedModel ? 'admin-embedding-item--active' : ''}`}
                  onClick={() => form.setFieldValue('multimodalModel', item.value)}
                >
                  <div className="admin-embedding-item__title">{item.value}</div>
                  <div className="admin-embedding-item__meta">
                    <span>提供方：{item.provider ?? '未标注'}</span>
                    {item.value === selectedModel ? <Tag color="blue">当前使用</Tag> : null}
                  </div>
                </button>
              )) : (
                <div className="admin-empty-state">
                  <strong>暂无多模态模型</strong>
                  <div>请先到“手动维护”里添加多模态模型。</div>
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
                label="多模态模型"
                name="multimodalModel"
                rules={[{ required: true, message: '请选择多模态模型' }]}
                extra="用于图文联合理解、图片问答、视觉推理等多模态场景。"
              >
                <Input placeholder="请选择或输入多模态模型" />
              </Form.Item>
            </Form>
            <Card size="small" className="admin-build-summary admin-build-summary--muted">
              当前多模态页签用于图文联合理解、图片问答、OCR、视觉推理等场景。后续如果要完全贴近参考图，可以继续补图片上传和预览测试区。
            </Card>
            <div className="admin-inline-meta">
              <Tag color="blue">图文联合理解</Tag>
              <Tag color="purple">OCR</Tag>
              <Tag color="cyan">问答</Tag>
              <Tag color="green">推理</Tag>
            </div>
            <div className="admin-action-row">
              <Button type="primary" onClick={onSave} loading={saving}>
                保存设置
              </Button>
              <Button onClick={onTest} loading={testing}>
                测试当前模型
              </Button>
              <Button onClick={() => form.resetFields(['multimodalModel'])} disabled={saving || loading}>
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
