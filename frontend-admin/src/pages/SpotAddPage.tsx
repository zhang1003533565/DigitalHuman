import { useState } from 'react'
import {
  Form,
  Input,
  Select,
  TimePicker,
  Radio,
  Button,
  Row,
  Col,
  Upload,
  Tooltip,
} from 'antd'
import {
  PlusOutlined,
  CloseCircleFilled,
  EnvironmentFilled,
  BoldOutlined,
  ItalicOutlined,
  UnderlineOutlined,
  StrikethroughOutlined,
  UnorderedListOutlined,
  OrderedListOutlined,
  LinkOutlined,
  PictureOutlined,
  TableOutlined,
  FullscreenOutlined,
  MoreOutlined,
  CodeOutlined,
} from '@ant-design/icons'

const { TextArea } = Input

type GalleryItem = {
  id: string
  url: string
}

const initialGallery: GalleryItem[] = [
  { id: 'g1', url: 'https://images.unsplash.com/photo-1545569341-9eb8b30979d9?w=400&q=60' },
  { id: 'g2', url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=60' },
  { id: 'g3', url: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=400&q=60' },
  { id: 'g4', url: 'https://images.unsplash.com/photo-1518684079-3c830dcef090?w=400&q=60' },
  { id: 'g5', url: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=400&q=60' },
]

function SectionTitle({ title }: { title: string }) {
  return (
    <div className="spot-add__section-title">
      <span className="spot-add__section-bar" />
      <span>{title}</span>
    </div>
  )
}

function SpotAddPage() {
  const [form] = Form.useForm()
  const [intro, setIntro] = useState('')
  const [detail, setDetail] = useState('')
  const [gallery, setGallery] = useState<GalleryItem[]>(initialGallery)

  const removeGalleryItem = (id: string) => {
    setGallery((prev) => prev.filter((item) => item.id !== id))
  }

  return (
    <div className="spot-add">
      <style>{styles}</style>

      {/* 顶部标题栏 */}
      <div className="spot-add__topbar">
        <h1 className="spot-add__title">新增景点</h1>
        <div className="spot-add__topbar-actions">
          <Button type="primary" size="large">
            发布景点
          </Button>
        </div>
      </div>

      {/* 基础信息 + 地图选点 */}
      <Row gutter={16} className="spot-add__row">
        <Col xs={24} lg={14}>
          <div className="spot-add__card">
            <SectionTitle title="基础信息" />
            <Form form={form} layout="horizontal" labelAlign="left" labelCol={{ flex: '88px' }}>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item label="景点名称" required>
                    <Input placeholder="请输入景点名称" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="景点分类" required>
                    <Select
                      placeholder="请选择景点分类"
                      options={[
                        { value: 'temple', label: '寺庙古迹' },
                        { value: 'nature', label: '自然风光' },
                        { value: 'culture', label: '文化场馆' },
                      ]}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item label="经度" required>
                    <Input placeholder="请输入经度，如：120.31" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="纬度" required>
                    <Input placeholder="请输入纬度，如：31.49" />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item label="开放时间" required labelCol={{ flex: '88px' }}>
                <Row gutter={8} align="middle">
                  <Col flex="1">
                    <TimePicker
                      style={{ width: '100%' }}
                      format="HH:mm"
                      placeholder="09:00"
                    />
                  </Col>
                  <Col flex="0 0 24px" style={{ textAlign: 'center', color: '#666' }}>
                    至
                  </Col>
                  <Col flex="1">
                    <TimePicker
                      style={{ width: '100%' }}
                      format="HH:mm"
                      placeholder="17:00"
                    />
                  </Col>
                </Row>
              </Form.Item>

              <Form.Item label="票价" required labelCol={{ flex: '88px' }}>
                <Input prefix="￥" placeholder="请输入票价，如：120" />
              </Form.Item>

              <Form.Item label="景点地址" required labelCol={{ flex: '88px' }}>
                <Input placeholder="请输入景点详细地址" />
              </Form.Item>

              <Form.Item label="状态" required labelCol={{ flex: '88px' }} style={{ marginBottom: 0 }}>
                <Radio.Group defaultValue="online">
                  <Radio value="online">上架</Radio>
                  <Radio value="offline">下架</Radio>
                </Radio.Group>
              </Form.Item>
            </Form>
          </div>
        </Col>

        <Col xs={24} lg={10}>
          <div className="spot-add__card">
            <SectionTitle title="地图选点" />
            <div className="spot-add__map">
              <div className="spot-add__map-pin">
                <EnvironmentFilled style={{ fontSize: 36, color: '#1677ff' }} />
              </div>
              <Button
                type="primary"
                icon={<EnvironmentFilled />}
                className="spot-add__map-btn"
              >
                点击选点
              </Button>
            </div>
            <p className="spot-add__map-hint">
              在地图上点击选择景点位置，拖动地图可调整视图位置
            </p>
          </div>
        </Col>
      </Row>

      {/* 图片信息 */}
      <div className="spot-add__card spot-add__row">
        <SectionTitle title="图片信息" />
        <Row gutter={32}>
          <Col flex="0 0 200px">
            <div className="spot-add__field-label">
              <span className="spot-add__required">*</span>封面图片
            </div>
            <Upload
              listType="picture-card"
              showUploadList={false}
              beforeUpload={() => false}
              className="spot-add__cover-upload"
            >
              <div className="spot-add__cover-inner">
                <PlusOutlined style={{ fontSize: 22, color: '#1677ff' }} />
                <div style={{ marginTop: 8, color: '#1677ff' }}>上传封面</div>
              </div>
            </Upload>
            <p className="spot-add__cover-hint">
              建议尺寸：1200×675px，JPG/PNG，≤2MB
            </p>
          </Col>

          <Col flex="1 1 0" style={{ minWidth: 0 }}>
            <div className="spot-add__field-label">景点组图</div>
            <div className="spot-add__gallery">
              {gallery.map((item) => (
                <div key={item.id} className="spot-add__gallery-item">
                  <img src={item.url} alt="景点" />
                  <CloseCircleFilled
                    className="spot-add__gallery-remove"
                    onClick={() => removeGalleryItem(item.id)}
                  />
                </div>
              ))}
              <div className="spot-add__gallery-add">
                <Upload showUploadList={false} beforeUpload={() => false}>
                  <div className="spot-add__gallery-add-inner">
                    <PlusOutlined style={{ fontSize: 22, color: '#999' }} />
                    <div style={{ marginTop: 6, color: '#666' }}>上传更多</div>
                  </div>
                </Upload>
              </div>
            </div>
            <p className="spot-add__cover-hint">最多上传8张，支持JPG/PNG</p>
          </Col>
        </Row>
      </div>

      {/* 描述信息 */}
      <div className="spot-add__card spot-add__row">
        <SectionTitle title="描述信息" />
        <Row gutter={16}>
          <Col xs={24} lg={8}>
            <div className="spot-add__field-label">
              <span className="spot-add__required">*</span>简介
            </div>
            <div className="spot-add__textarea-wrap">
              <TextArea
                rows={6}
                maxLength={200}
                value={intro}
                onChange={(e) => setIntro(e.target.value)}
                placeholder="请输入景点简介，推荐50-200字"
              />
              <div className="spot-add__count">{intro.length}/200</div>
            </div>
          </Col>

          <Col xs={24} lg={16}>
            <div className="spot-add__field-label">
              <span className="spot-add__required">*</span>详细介绍
            </div>
            <div className="spot-add__editor">
              <div className="spot-add__editor-toolbar">
                <Select
                  size="small"
                  defaultValue="paragraph"
                  variant="borderless"
                  style={{ width: 80 }}
                  options={[
                    { value: 'paragraph', label: '段落' },
                    { value: 'h1', label: '标题1' },
                    { value: 'h2', label: '标题2' },
                  ]}
                />
                <span className="spot-add__editor-divider" />
                <Tooltip title="加粗"><Button type="text" size="small" icon={<BoldOutlined />} /></Tooltip>
                <Tooltip title="斜体"><Button type="text" size="small" icon={<ItalicOutlined />} /></Tooltip>
                <Tooltip title="下划线"><Button type="text" size="small" icon={<UnderlineOutlined />} /></Tooltip>
                <Tooltip title="删除线"><Button type="text" size="small" icon={<StrikethroughOutlined />} /></Tooltip>
                <span className="spot-add__editor-divider" />
                <Tooltip title="引用"><Button type="text" size="small">"</Button></Tooltip>
                <Tooltip title="代码"><Button type="text" size="small" icon={<CodeOutlined />} /></Tooltip>
                <span className="spot-add__editor-divider" />
                <Tooltip title="无序列表"><Button type="text" size="small" icon={<UnorderedListOutlined />} /></Tooltip>
                <Tooltip title="有序列表"><Button type="text" size="small" icon={<OrderedListOutlined />} /></Tooltip>
                <span className="spot-add__editor-divider" />
                <Tooltip title="链接"><Button type="text" size="small" icon={<LinkOutlined />} /></Tooltip>
                <Tooltip title="图片"><Button type="text" size="small" icon={<PictureOutlined />} /></Tooltip>
                <Tooltip title="表格"><Button type="text" size="small" icon={<TableOutlined />} /></Tooltip>
                <span className="spot-add__editor-divider" />
                <Tooltip title="全屏"><Button type="text" size="small" icon={<FullscreenOutlined />} /></Tooltip>
                <Tooltip title="更多"><Button type="text" size="small" icon={<MoreOutlined />} /></Tooltip>
              </div>
              <TextArea
                rows={6}
                maxLength={5000}
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                placeholder="请输入景点详细介绍..."
                variant="borderless"
                className="spot-add__editor-textarea"
              />
              <div className="spot-add__count spot-add__count--editor">{detail.length}/5000</div>
            </div>
          </Col>
        </Row>
      </div>

      {/* 底部操作栏 */}
      <div className="spot-add__footer">
        <Button type="primary" size="large">
          保存并提交
        </Button>
      </div>
    </div>
  )
}

const styles = `
.spot-add {
  padding: 0 0 32px;
  background: #f5f7fa;
  min-height: 100%;
}
.spot-add__topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.spot-add__title {
  font-size: 26px;
  font-weight: 700;
  margin: 0;
  color: #1f1f1f;
  line-height: 1.2;
}
.spot-add__topbar-actions {
  display: flex;
  gap: 12px;
}
.spot-add__row {
  margin-bottom: 16px;
}
.spot-add__card {
  background: #fff;
  border-radius: 8px;
  padding: 20px 24px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  height: 100%;
}
.spot-add__section-title {
  display: flex;
  align-items: center;
  font-size: 16px;
  font-weight: 600;
  color: #1f1f1f;
  margin-bottom: 20px;
}
.spot-add__section-bar {
  display: inline-block;
  width: 3px;
  height: 16px;
  background: #1677ff;
  margin-right: 8px;
  border-radius: 2px;
}
.spot-add__map {
  position: relative;
  height: 240px;
  border-radius: 6px;
  background-image: url('https://api.maptiler.com/maps/streets/static/120.31,31.49,13/600x320.png?key=demo'),
    linear-gradient(135deg, #e6f1ff 0%, #d6e4f5 100%);
  background-size: cover;
  background-position: center;
  overflow: hidden;
}
.spot-add__map-pin {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -100%);
}
.spot-add__map-btn {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  box-shadow: 0 2px 8px rgba(22, 119, 255, 0.3);
}
.spot-add__map-hint {
  font-size: 12px;
  color: #999;
  margin: 8px 0 0 0;
}
.spot-add__field-label {
  font-size: 14px;
  color: #1f1f1f;
  margin-bottom: 8px;
}
.spot-add__required {
  color: #ff4d4f;
  margin-right: 4px;
}
.spot-add__cover-upload :where(.ant-upload.ant-upload-select) {
  width: 180px;
  height: 130px;
  margin: 0;
  border: 1px dashed #d9d9d9;
  border-radius: 6px;
  background: #fafbfc;
}
.spot-add__cover-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.spot-add__cover-hint {
  font-size: 12px;
  color: #999;
  margin: 8px 0 0 0;
}
.spot-add__gallery {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 12px;
}
.spot-add__gallery-item {
  position: relative;
  aspect-ratio: 1 / 1;
  border-radius: 6px;
  overflow: hidden;
  background: #f0f0f0;
}
.spot-add__gallery-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.spot-add__gallery-remove {
  position: absolute;
  top: 4px;
  right: 4px;
  font-size: 18px;
  color: rgba(0, 0, 0, 0.55);
  background: #fff;
  border-radius: 50%;
  cursor: pointer;
}
.spot-add__gallery-add {
  aspect-ratio: 1 / 1;
  border: 1px dashed #d9d9d9;
  border-radius: 6px;
  background: #fafbfc;
  display: flex;
  align-items: center;
  justify-content: center;
}
.spot-add__gallery-add :where(.ant-upload) {
  width: 100%;
  height: 100%;
}
.spot-add__gallery-add-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}
.spot-add__textarea-wrap {
  position: relative;
}
.spot-add__count {
  position: absolute;
  bottom: 6px;
  right: 12px;
  font-size: 12px;
  color: #bfbfbf;
  pointer-events: none;
}
.spot-add__editor {
  position: relative;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  overflow: hidden;
  background: #fff;
}
.spot-add__editor-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 2px;
  padding: 6px 8px;
  border-bottom: 1px solid #f0f0f0;
  background: #fafafa;
}
.spot-add__editor-divider {
  display: inline-block;
  width: 1px;
  height: 16px;
  background: #e8e8e8;
  margin: 0 4px;
}
.spot-add__editor-textarea {
  resize: none !important;
  padding: 12px;
}
.spot-add__count--editor {
  bottom: 8px;
  right: 16px;
}
.spot-add__footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
`

export default SpotAddPage
