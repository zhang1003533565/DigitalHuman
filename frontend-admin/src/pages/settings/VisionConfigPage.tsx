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

export default function VisionConfigPage({
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
}: VisionConfigPageProps) {
  const selectedModel = Form.useWatch('visionModel', form)
  const currentOption = options.find((item) => item.value === selectedModel)
  const [searchText, setSearchText] = useState('')
  const [promptText, setPromptText] = useState('')
  const [imageDataUrl, setImageDataUrl] = useState('')
  const [activeMode, setActiveMode] = useState<'caption' | 'ocr' | 'qa' | 'scene'>('caption')
  const [page, setPage] = useState(1)

  const modePresets = {
    caption: '请描述图片中的主要内容。',
    ocr: '请识别图片中的文字内容。',
    qa: '请根据图片内容回答问题。',
    scene: '请分析图片场景，并说明这是什么地方。',
  }

  const modeDescriptions = {
    caption: '适合快速生成图片整体描述、识别主体和环境信息。',
    ocr: '适合识别图片中的招牌、告示、票据、海报等文字内容。',
    qa: '适合围绕图片提问，例如“这是什么地方”“图中有什么设施”。',
    scene: '适合分析场景属性、空间关系、旅游环境和景区特征。',
  }

  const filteredOptions = options.filter((item) => {
    const keyword = searchText.trim().toLowerCase()
    if (!keyword) return true
    return item.value.toLowerCase().includes(keyword) || (item.provider ?? '').toLowerCase().includes(keyword)
  })
  const pagedOptions = useMemo(() => filteredOptions.slice((page - 1) * 4, page * 4), [filteredOptions, page])

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
    <div className="admin-form-grid">
      <div className="admin-two-column admin-embedding-layout">
        <Card title="视觉模型列表" className="admin-settings-panel-card">
          <div className="admin-form-grid">
            <div className="admin-list-toolbar">
              <Input
                placeholder="搜索视觉模型名称或标识"
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
            {filteredOptions.length > 4 ? (
              <Pagination
                current={page}
                total={filteredOptions.length}
                pageSize={4}
                size="small"
                onChange={setPage}
                className="admin-mini-pagination"
              />
            ) : null}
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
              <Button onClick={() => onTest({ promptText, imageDataUrl, mode: activeMode })} loading={testing}>
                测试当前模型
              </Button>
              <Button onClick={() => form.resetFields(['visionModel'])} disabled={saving || loading}>
                重置表单
              </Button>
            </div>
            <div className="admin-inline-meta">
              <Tag color="blue">图片理解</Tag>
              <Tag color="purple">OCR</Tag>
              <Tag color="cyan">问答</Tag>
              <Tag color="green">识别</Tag>
            </div>
            <div className="admin-mode-row">
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
                type={activeMode === 'scene' ? 'primary' : 'default'}
                className={activeMode === 'scene' ? 'admin-mode-btn admin-mode-btn--active' : 'admin-mode-btn'}
                onClick={() => {
                  setActiveMode('scene')
                  setPromptText(modePresets.scene)
                }}
              >
                场景理解
              </Button>
            </div>
            <Card size="small" className="admin-build-summary admin-build-summary--muted">
              <div className="admin-form-grid">
                <Upload {...uploadProps}>
                  <Button>上传测试图片</Button>
                </Upload>
                {imageDataUrl ? (
                  <div className="admin-vision-preview-wrap">
                    <button type="button" className="admin-preview-remove" onClick={() => setImageDataUrl('')}>
                      ×
                    </button>
                    <img src={imageDataUrl} alt="视觉测试预览" className="admin-vision-preview" />
                  </div>
                ) : (
                  <div className="admin-empty-state">
                    <strong>暂无测试图片</strong>
                    <div>上传一张图片后，可用于视觉理解、OCR 和图像问答测试。支持 JPG / PNG / WEBP。</div>
                  </div>
                )}
                <Input.TextArea
                  rows={4}
                  value={promptText}
                  onChange={(event) => setPromptText(event.target.value)}
                  placeholder="请输入测试问题，例如：请识别图中的景点并简要说明。"
                />
                <div className="admin-build-summary__time">{modeDescriptions[activeMode]}</div>
              </div>
            </Card>
            {imageDataUrl && testResult?.success ? (
              <Card size="small" className="admin-build-summary">
                <div className="admin-form-grid">
                  <strong>结果预览</strong>
                  <div className="admin-preview-grid">
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
                    <div className={`admin-preview-block ${activeMode === 'scene' ? 'admin-preview-block--active' : ''}`}>
                      <Tag color={activeMode === 'scene' ? 'green' : 'default'}>场景理解</Tag>
                      <strong>场景理解</strong>
                      <div>{testResult.sceneSummary ?? '点击“场景理解”并重新测试可查看此结果。'}</div>
                    </div>
                  </div>
                </div>
              </Card>
            ) : null}
            {result}
          </div>
        </Card>
      </div>
    </div>
  )
}
