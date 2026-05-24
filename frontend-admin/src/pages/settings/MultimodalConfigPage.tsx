import { useMemo, useState } from 'react'
import { Button, Card, Form, Input, Pagination, Tag, Upload } from 'antd'
import type { FormInstance } from 'antd'
import type { UploadProps } from 'antd'

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
  onOpenManual: () => void
  onSave: () => void
  onTest: (payload?: { promptText?: string; imageDataUrl?: string; mode?: string }) => void
  result: React.ReactNode
  testResult?: {
    success: boolean
    message: string
    detail?: string
    caption?: string
    ocrText?: string
    modelAnswer?: string
    sceneSummary?: string
  } | null
}

export default function MultimodalConfigPage({
  form,
  loading,
  saving,
  testing,
  options,
  onOpenManual,
  onSave,
  onTest,
  result,
  testResult,
}: MultimodalConfigPageProps) {
  const selectedModel = Form.useWatch('multimodalModel', form)
  const currentOption = options.find((item) => item.value === selectedModel)
  const [searchText, setSearchText] = useState('')
  const [promptText, setPromptText] = useState('')
  const [imageDataUrl, setImageDataUrl] = useState('')
  const [activeMode, setActiveMode] = useState<'caption' | 'ocr' | 'qa' | 'reason'>('caption')
  const [page, setPage] = useState(1)

  const modePresets = {
    caption: '请描述图片中的主要内容。',
    ocr: '请识别图片中的文字内容。',
    qa: '请根据图片回答问题。',
    reason: '请分析场景并给出综合理解。',
  }

  const modeDescriptions = {
    caption: '适合生成图像内容摘要，快速理解画面主体。',
    ocr: '适合识别图片文字、招牌、票面信息和海报内容。',
    qa: '适合基于图片做具体问答，例如识别景点、设施和物体关系。',
    reason: '适合对旅游场景做综合理解，例如风格、用途、空间关系与推荐解读。',
  }

  const filteredOptions = options.filter((item) => {
    const keyword = searchText.trim().toLowerCase()
    if (!keyword) return true
    return item.value.toLowerCase().includes(keyword) || (item.provider ?? '').toLowerCase().includes(keyword)
  })
  const pagedOptions = useMemo(() => filteredOptions.slice((page - 1) * 4, page * 4), [filteredOptions, page])
  const totalItems = Math.max(filteredOptions.length, 1)

  const uploadProps: UploadProps = {
    accept: '.png,.jpg,.jpeg,.webp',
    showUploadList: false,
    beforeUpload: async (file) => {
      const reader = new FileReader()
      reader.onload = () => setImageDataUrl(String(reader.result ?? ''))
      reader.readAsDataURL(file)
      return false
    },
  }

  return (
    <div className="admin-form-grid admin-multimodal-page">
      <div className="admin-two-column admin-embedding-layout admin-multimodal-layout">
        <Card title="多模态模型列表" className="admin-settings-panel-card admin-settings-panel-card--narrow">
          <div className="admin-form-grid">
            <div className="admin-list-toolbar">
              <Input
                placeholder="搜索模型名称或标识"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
              />
              <Button type="primary" ghost onClick={onOpenManual}>新增模型</Button>
            </div>
            <div className="admin-embedding-list">
              {pagedOptions.length ? pagedOptions.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={`admin-embedding-item admin-embedding-item--compact ${item.value === selectedModel ? 'admin-embedding-item--active' : ''}`}
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
            <Pagination
              current={page}
              total={totalItems}
              pageSize={4}
              size="small"
              onChange={setPage}
              className="admin-mini-pagination"
              hideOnSinglePage={false}
              showSizeChanger={false}
            />
          </div>
        </Card>
        <Card title="模型配置" className="admin-settings-panel-card">
          <div className="admin-form-grid admin-multimodal-config">
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
            <div className="admin-inline-meta">
              <Tag color="blue">图文联合理解</Tag>
              <Tag color="purple">OCR</Tag>
              <Tag color="cyan">问答</Tag>
              <Tag color="green">推理</Tag>
            </div>
            <div className="admin-multimodal-workbench">
              <div className="admin-multimodal-media">
                <Upload {...uploadProps}>
                  <Button className="admin-multimodal-upload-btn">上传测试图片</Button>
                </Upload>
                <div className="admin-multimodal-media-frame">
                  {imageDataUrl ? (
                    <div className="admin-vision-preview-wrap admin-vision-preview-wrap--fixed">
                      <button type="button" className="admin-preview-remove" onClick={() => setImageDataUrl('')}>
                        ×
                      </button>
                      <img src={imageDataUrl} alt="多模态测试预览" className="admin-vision-preview admin-vision-preview--fixed" />
                    </div>
                  ) : (
                    <div className="admin-empty-state admin-empty-state--media">
                      <strong>暂无测试图片</strong>
                      <div>上传一张图片后，可结合提示词做图文联合测试。支持 JPG / PNG / WEBP。</div>
                    </div>
                  )}
                </div>
              </div>
              <div className="admin-multimodal-side">
                <Input.TextArea
                  rows={4}
                  value={promptText}
                  onChange={(event) => setPromptText(event.target.value)}
                  placeholder="请输入测试问题，例如：请识别图片中的景点并简要介绍。"
                />
                <div className="admin-mode-row admin-mode-row--compact">
                  <Button
                    type={activeMode === 'caption' ? 'primary' : 'default'}
                    className={activeMode === 'caption' ? 'admin-mode-btn admin-mode-btn--active' : 'admin-mode-btn'}
                    onClick={() => {
                      setActiveMode('caption')
                      setPromptText(modePresets.caption)
                    }}
                  >
                    图片描述
                  </Button>
                  <Button
                    type={activeMode === 'ocr' ? 'primary' : 'default'}
                    className={activeMode === 'ocr' ? 'admin-mode-btn admin-mode-btn--active' : 'admin-mode-btn'}
                    onClick={() => {
                      setActiveMode('ocr')
                      setPromptText(modePresets.ocr)
                    }}
                  >
                    OCR识别
                  </Button>
                  <Button
                    type={activeMode === 'qa' ? 'primary' : 'default'}
                    className={activeMode === 'qa' ? 'admin-mode-btn admin-mode-btn--active' : 'admin-mode-btn'}
                    onClick={() => {
                      setActiveMode('qa')
                      setPromptText(modePresets.qa)
                    }}
                  >
                    图片问答
                  </Button>
                  <Button
                    type={activeMode === 'reason' ? 'primary' : 'default'}
                    className={activeMode === 'reason' ? 'admin-mode-btn admin-mode-btn--active' : 'admin-mode-btn'}
                    onClick={() => {
                      setActiveMode('reason')
                      setPromptText(modePresets.reason)
                    }}
                  >
                    场景理解
                  </Button>
                </div>
                <div className="admin-build-summary__time">{modeDescriptions[activeMode]}</div>
                {imageDataUrl && testResult?.success ? (
                  <div className="admin-preview-grid admin-preview-grid--fixed">
                    <div className={`admin-preview-block ${activeMode === 'caption' ? 'admin-preview-block--active' : ''}`}>
                      <Tag color={activeMode === 'caption' ? 'blue' : 'default'}>图片描述</Tag>
                      <strong>图片描述</strong>
                      <div>{testResult.caption ?? '点击“图片描述”并重新测试可查看此结果。'}</div>
                    </div>
                    <div className={`admin-preview-block ${activeMode === 'ocr' ? 'admin-preview-block--active' : ''}`}>
                      <Tag color={activeMode === 'ocr' ? 'purple' : 'default'}>OCR</Tag>
                      <strong>识别文字</strong>
                      <div>{testResult.ocrText ?? '点击“OCR识别”并重新测试可查看此结果。'}</div>
                    </div>
                    <div className={`admin-preview-block ${activeMode === 'qa' ? 'admin-preview-block--active' : ''}`}>
                      <Tag color={activeMode === 'qa' ? 'cyan' : 'default'}>问答</Tag>
                      <strong>模型回答</strong>
                      <div>{testResult.modelAnswer ?? '点击“图片问答”并重新测试可查看此结果。'}</div>
                    </div>
                    <div className={`admin-preview-block ${activeMode === 'reason' ? 'admin-preview-block--active' : ''}`}>
                      <Tag color={activeMode === 'reason' ? 'green' : 'default'}>场景理解</Tag>
                      <strong>场景理解</strong>
                      <div>{testResult.sceneSummary ?? '点击“场景理解”并重新测试可查看此结果。'}</div>
                    </div>
                  </div>
                ) : (
                  <Card size="small" className="admin-build-summary admin-build-summary--muted admin-preview-placeholder">
                    结果预览区会在你上传图片并执行测试后显示。当前模式下将优先展示对应的结构化结果。
                  </Card>
                )}
              </div>
            </div>
            <div className="admin-action-row">
              <Button type="primary" onClick={onSave} loading={saving}>
                保存设置
              </Button>
              <Button onClick={() => onTest({ promptText, imageDataUrl, mode: activeMode })} loading={testing}>
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
