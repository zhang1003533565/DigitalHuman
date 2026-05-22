import { useEffect, useRef, useState } from 'react'
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
  message,
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

// ===== 高德地图相关常量 =====
const AMAP_KEY = '5b01b946c26d0f94f7d2ddb9d09ff26f'
const AMAP_SECURITY_KEY = '692196a068ef6c9cad53a55fc9e47ad7'
// 灵山胜境景区中心坐标 [lng, lat]
const LINGSHAN_CENTER: [number, number] = [120.1009, 31.4259]
// 灵山景区选点允许范围（西南、东北）
const LINGSHAN_BOUNDS_SW: [number, number] = [120.0759, 31.4009]
const LINGSHAN_BOUNDS_NE: [number, number] = [120.1259, 31.4509]

declare global {
  interface Window {
    _AMapSecurityConfig?: { securityJsCode: string }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    AMap?: any
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let amapLoaderPromise: Promise<any> | null = null

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function loadAMap(): Promise<any> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'))
  if (window.AMap) return Promise.resolve(window.AMap)
  if (amapLoaderPromise) return amapLoaderPromise

  window._AMapSecurityConfig = { securityJsCode: AMAP_SECURITY_KEY }
  amapLoaderPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${AMAP_KEY}`
    script.async = true
    script.onload = () => resolve(window.AMap)
    script.onerror = (err) => {
      amapLoaderPromise = null
      reject(err)
    }
    document.head.appendChild(script)
  })
  return amapLoaderPromise
}

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

  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const boundsRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const geolocationRef = useRef<any>(null)

  const removeGalleryItem = (id: string) => {
    setGallery((prev) => prev.filter((item) => item.id !== id))
  }

  // 初始化高德地图：限制视野与选点范围在灵山景区
  useEffect(() => {
    let cancelled = false
    loadAMap()
      .then((AMap) => {
        if (cancelled || !mapContainerRef.current) return

        const sw = new AMap.LngLat(LINGSHAN_BOUNDS_SW[0], LINGSHAN_BOUNDS_SW[1])
        const ne = new AMap.LngLat(LINGSHAN_BOUNDS_NE[0], LINGSHAN_BOUNDS_NE[1])
        const bounds = new AMap.Bounds(sw, ne)
        boundsRef.current = bounds

        const map = new AMap.Map(mapContainerRef.current, {
          zoom: 15,
          center: LINGSHAN_CENTER,
          viewMode: '2D',
          zooms: [13, 19],
          mapStyle: 'amap://styles/normal',
        })
        // 限制地图浏览范围在灵山景区内
        map.setLimitBounds?.(bounds)
        mapInstanceRef.current = map

        // 初始标记点（默认中心）
        const marker = new AMap.Marker({
          position: LINGSHAN_CENTER,
          draggable: true,
          cursor: 'move',
          map,
        })
        markerRef.current = marker
        // 同步初始经纬度到表单
        form.setFieldsValue({
          longitude: LINGSHAN_CENTER[0].toFixed(6),
          latitude: LINGSHAN_CENTER[1].toFixed(6),
        })

        // 点击地图选点：仅允许在灵山景区范围内
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        map.on('click', (e: any) => {
          const lngLat = e?.lnglat
          if (!lngLat) return
          if (boundsRef.current && !boundsRef.current.contains(lngLat)) {
            message.warning('请在灵山景区范围内选点')
            return
          }
          marker.setPosition(lngLat)
          form.setFieldsValue({
            longitude: lngLat.getLng().toFixed(6),
            latitude: lngLat.getLat().toFixed(6),
          })
        })

        // 拖拽标记选点
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        marker.on('dragend', (e: any) => {
          const lngLat = e?.lnglat ?? marker.getPosition()
          if (!lngLat) return
          if (boundsRef.current && !boundsRef.current.contains(lngLat)) {
            message.warning('请在灵山景区范围内选点')
            marker.setPosition(LINGSHAN_CENTER)
            form.setFieldsValue({
              longitude: LINGSHAN_CENTER[0].toFixed(6),
              latitude: LINGSHAN_CENTER[1].toFixed(6),
            })
            return
          }
          form.setFieldsValue({
            longitude: lngLat.getLng().toFixed(6),
            latitude: lngLat.getLat().toFixed(6),
          })
        })

        // 加载控件插件：工具条（缩放）、比例尺、定位
        AMap.plugin(
          ['AMap.ToolBar', 'AMap.Scale', 'AMap.Geolocation'],
          () => {
            if (cancelled) return
            const toolbar = new AMap.ToolBar({
              position: { top: '10px', right: '10px' },
              ruler: false,
              direction: false,
              locate: false,
            })
            map.addControl(toolbar)

            const scale = new AMap.Scale({ position: 'LB' })
            map.addControl(scale)

            const geolocation = new AMap.Geolocation({
              enableHighAccuracy: true,
              timeout: 10000,
              buttonPosition: 'RB',
              showButton: true,
              showMarker: false,
              showCircle: false,
              panToLocation: false,
              zoomToAccuracy: false,
            })
            map.addControl(geolocation)
            geolocationRef.current = geolocation
          },
        )
      })
      .catch((err) => {
        console.error('AMap load failed', err)
      })

    return () => {
      cancelled = true
      if (mapInstanceRef.current) {
        mapInstanceRef.current.destroy?.()
        mapInstanceRef.current = null
      }
      markerRef.current = null
      boundsRef.current = null
      geolocationRef.current = null
    }
  }, [form])

  // 重置选点到灵山景区中心
  const handleResetCenter = () => {
    const map = mapInstanceRef.current
    const marker = markerRef.current
    if (!map || !marker) return
    map.setZoomAndCenter?.(15, LINGSHAN_CENTER)
    marker.setPosition(LINGSHAN_CENTER)
    form.setFieldsValue({
      longitude: LINGSHAN_CENTER[0].toFixed(6),
      latitude: LINGSHAN_CENTER[1].toFixed(6),
    })
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
        <Col xs={24} lg={7}>
          <div className="spot-add__card">
            <SectionTitle title="基础信息" />
            <Form form={form} layout="horizontal" labelAlign="left" labelCol={{ flex: '88px' }}>
              <Row gutter={16}>
                <Col span={24}>
                  <Form.Item label="景点名称" required>
                    <Input placeholder="请输入景点名称" />
                  </Form.Item>
                </Col>
                <Col span={24}>
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
                <Col span={24}>
                  <Form.Item label="经度" name="longitude" required>
                    <Input placeholder="请在右侧地图选点" readOnly />
                  </Form.Item>
                </Col>
                <Col span={24}>
                  <Form.Item label="纬度" name="latitude" required>
                    <Input placeholder="请在右侧地图选点" readOnly />
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

        <Col xs={24} lg={17}>
          <div className="spot-add__card">
            <SectionTitle title="地图选点" />
            <div className="spot-add__map">
              <div ref={mapContainerRef} className="spot-add__map-canvas" />
              <Button
                type="primary"
                icon={<EnvironmentFilled />}
                className="spot-add__map-btn"
                onClick={handleResetCenter}
              >
                回到景区中心
              </Button>
            </div>
            <p className="spot-add__map-hint">
              在地图上点击或拖动标记选择景点位置，仅可在灵山景区范围内选点
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
  height: 520px;
  min-height: 420px;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid #e6eaf0;
}
@media (max-width: 1200px) {
  .spot-add__map {
    height: 420px;
  }
}
.spot-add__map-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.spot-add__map-pin {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -100%);
  pointer-events: none;
}
.spot-add__map-btn {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  box-shadow: 0 2px 8px rgba(22, 119, 255, 0.3);
  z-index: 10;
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
