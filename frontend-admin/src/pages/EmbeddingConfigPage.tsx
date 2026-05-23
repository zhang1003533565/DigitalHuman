import { Button, Card, Form, Input, Tag } from 'antd'
import type { FormInstance } from 'antd'

type AdminModelSettings = {
  embeddingModel: string
  speechModel: string
  visionModel: string
  chatModel: string
  multimodalModel: string
}

type EmbeddingOption = {
  value: string
  provider?: string
}

type EmbeddingConfigPageProps = {
  form: FormInstance<AdminModelSettings>
  loading: boolean
  saving: boolean
  testing: boolean
  options: EmbeddingOption[]
  onSave: () => void
  onTest: () => void
  result: React.ReactNode
}

export default function EmbeddingConfigPage({
  form,
  loading,
  saving,
  testing,
  options,
  onSave,
  onTest,
  result,
}: EmbeddingConfigPageProps) {
  const selectedModel = Form.useWatch('embeddingModel', form)
  const currentOption = options.find((item) => item.value === selectedModel)

  return (
    <div className="admin-form-grid">
      <div className="admin-two-column admin-embedding-layout">
        <Card title="嵌入模型列表" className="admin-settings-panel-card">
          <div className="admin-form-grid">
            <Input placeholder="搜索嵌入模型名称" disabled />
            <div className="admin-embedding-list">
              {options.length ? options.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={`admin-embedding-item ${item.value === selectedModel ? 'admin-embedding-item--active' : ''}`}
                  onClick={() => form.setFieldValue('embeddingModel', item.value)}
                >
                  <div className="admin-embedding-item__title">{item.value}</div>
                  <div className="admin-embedding-item__meta">
                    <span>提供方：{item.provider ?? '未标注'}</span>
                    {item.value === selectedModel ? <Tag color="blue">当前候选</Tag> : null}
                  </div>
                </button>
              )) : (
                <div className="admin-empty-state">
                  <strong>暂无嵌入模型</strong>
                  <div>请先到“手动维护”里添加嵌入模型。</div>
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
                label="模型名称"
                name="embeddingModel"
                rules={[{ required: true, message: '请选择嵌入模型' }]}
                extra="用于知识库分块向量化与相似度检索。"
              >
                <Input placeholder="请选择或输入嵌入模型" />
              </Form.Item>
            </Form>
            <div className="admin-action-row">
              <Button type="primary" onClick={onSave} loading={saving}>
                保存设置
              </Button>
              <Button onClick={onTest} loading={testing}>
                测试当前模型
              </Button>
              <Button onClick={() => form.resetFields()} disabled={saving || loading}>
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
