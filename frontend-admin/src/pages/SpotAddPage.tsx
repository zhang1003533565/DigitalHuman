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
  Drawer,
  message,
} from 'antd'
import {
  PlusOutlined,
  CloseCircleFilled,
  EnvironmentFilled,
} from '@ant-design/icons'

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

/** SpotDrawer 组件 Props */
export interface SpotDrawerProps {
  /** 是否展开侧边栏 */
  open: boolean
  /** 关闭回调 */
  onClose: () => void
  /** 顶部标题，默认"新增景点" */
  title?: string
  /** 操作按钮文字，默认"发布景点" */
  actionText?: string
  /** 操作按钮点击回调 */
  onAction?: () => void
}

function SectionTitle({ title }: { title: string }) {
  return (
    <div className="spot-drawer__section-title">
      <span className="spot-drawer__section-bar" />
      <span>{title}</span>
    </div>
  )
}

function SpotDrawer({
  open,
  onClose,
  title = '新增景点',
  actionText = '发布景点',
  onAction,
}: SpotDrawerProps) {
  const [form] = Form.useForm()
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
  // 组件是否已挂载（防止异步回调在卸载后操作 DOM）
  const isMountedRef = useRef(false)

  const removeGalleryItem = (id: string) => {
    setGallery((prev) => prev.filter((item) => item.id !== id))
  }

  // 仅负责卸载时清理地图实例
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      if (mapInstanceRef.current) {
        mapInstanceRef.current.destroy?.()
        mapInstanceRef.current = null
      }
      markerRef.current = null
      boundsRef.current = null
      geolocationRef.current = null
    }
  }, [])

  // Drawer 动画结束后调用，此时容器已在视口内，AMap 可正确读取尺寸并加载瓦片
  const initAMap = () => {
    if (mapInstanceRef.current || !mapContainerRef.current) return
    loadAMap()
      .then((AMap) => {
        if (!isMountedRef.current || !mapContainerRef.current || mapInstanceRef.current) return

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
        map.setLimitBounds?.(bounds)
        mapInstanceRef.current = map

        const marker = new AMap.Marker({
          position: LINGSHAN_CENTER,
          draggable: true,
          cursor: 'move',
          map,
        })
        markerRef.current = marker
        form.setFieldsValue({
          longitude: LINGSHAN_CENTER[0].toFixed(6),
          latitude: LINGSHAN_CENTER[1].toFixed(6),
        })

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

        AMap.plugin(
          ['AMap.ToolBar', 'AMap.Scale', 'AMap.Geolocation'],
          () => {
            if (!isMountedRef.current) return
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
  }

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
    <Drawer
      open={open}
      onClose={onClose}
      placement="right"
      width="80%"
      closable={false}
      destroyOnClose
      styles={{ body: { padding: 0, background: '#f5f7fa' } }}
      afterOpenChange={(visible) => {
        if (visible) initAMap()
      }}
    >
      <div className="spot-drawer">
        <style>{styles}</style>

        {/* 顶部标题栏 */}
        <div className="spot-drawer__topbar">
          <h1 className="spot-drawer__title">{title}</h1>
          <div className="spot-drawer__topbar-actions">
            <Button onClick={onClose} size="large">
              取消
            </Button>
            <Button type="primary" size="large" onClick={onAction}>
              {actionText}
            </Button>
          </div>
        </div>

        {/* 基础信息 + 地图选点 */}
        <Row gutter={16} className="spot-drawer__row">
          <Col xs={24} lg={10}>
            <div className="spot-drawer__card">
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

          <Col xs={24} lg={14}>
            <div className="spot-drawer__card">
              <SectionTitle title="地图选点" />
              <div className="spot-drawer__map">
                <div ref={mapContainerRef} className="spot-drawer__map-canvas" />
                <Button
                  type="primary"
                  icon={<EnvironmentFilled />}
                  className="spot-drawer__map-btn"
                  onClick={handleResetCenter}
                >
                  回到景区中心
                </Button>
              </div>
              <p className="spot-drawer__map-hint">
                在地图上点击或拖动标记选择景点位置，仅可在灵山景区范围内选点
              </p>
            </div>
          </Col>
        </Row>

        {/* 图片信息 */}
        <div className="spot-drawer__card spot-drawer__row">
          <SectionTitle title="图片信息" />
          <Row gutter={32}>
            <Col flex="0 0 200px">
              <div className="spot-drawer__field-label">
                <span className="spot-drawer__required">*</span>封面图片
              </div>
              <Upload
                listType="picture-card"
                showUploadList={false}
                beforeUpload={() => false}
                className="spot-drawer__cover-upload"
              >
                <div className="spot-drawer__cover-inner">
                  <PlusOutlined style={{ fontSize: 22, color: '#1677ff' }} />
                  <div style={{ marginTop: 8, color: '#1677ff' }}>上传封面</div>
                </div>
              </Upload>
              <p className="spot-drawer__cover-hint">
                建议尺寸：1200×675px，JPG/PNG，≤2MB
              </p>
            </Col>

            <Col flex="1 1 0" style={{ minWidth: 0 }}>
              <div className="spot-drawer__field-label">景点组图</div>
              <div className="spot-drawer__gallery">
                {gallery.map((item) => (
                  <div key={item.id} className="spot-drawer__gallery-item">
                    <img src={item.url} alt="景点" />
                    <CloseCircleFilled
                      className="spot-drawer__gallery-remove"
                      onClick={() => removeGalleryItem(item.id)}
                    />
                  </div>
                ))}
                <div className="spot-drawer__gallery-add">
                  <Upload showUploadList={false} beforeUpload={() => false}>
                    <div className="spot-drawer__gallery-add-inner">
                      <PlusOutlined style={{ fontSize: 22, color: '#999' }} />
                      <div style={{ marginTop: 6, color: '#666' }}>上传更多</div>
                    </div>
                  </Upload>
                </div>
              </div>
              <p className="spot-drawer__cover-hint">最多上传8张，支持JPG/PNG</p>
            </Col>
          </Row>
        </div>

      </div>
    </Drawer>
  )
}

const styles = `
.spot-drawer {
  padding: 20px 24px 32px;
  background: #f5f7fa;
  min-height: 100%;
}
.spot-drawer__topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid #f0f0f0;
}
.spot-drawer__title {
  font-size: 22px;
  font-weight: 700;
  margin: 0;
  color: #1f1f1f;
  line-height: 1.2;
}
.spot-drawer__topbar-actions {
  display: flex;
  gap: 12px;
}
.spot-drawer__row {
  margin-bottom: 16px;
}
.spot-drawer__card {
  background: #fff;
  border-radius: 8px;
  padding: 20px 24px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  height: 100%;
}
.spot-drawer__section-title {
  display: flex;
  align-items: center;
  font-size: 16px;
  font-weight: 600;
  color: #1f1f1f;
  margin-bottom: 20px;
}
.spot-drawer__section-bar {
  display: inline-block;
  width: 3px;
  height: 16px;
  background: #1677ff;
  margin-right: 8px;
  border-radius: 2px;
}
.spot-drawer__map {
  position: relative;
  height: 400px;
  min-height: 320px;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid #e6eaf0;
}
.spot-drawer__map-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.spot-drawer__map-btn {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  box-shadow: 0 2px 8px rgba(22, 119, 255, 0.3);
  z-index: 10;
}
.spot-drawer__map-hint {
  font-size: 12px;
  color: #999;
  margin: 8px 0 0 0;
}
.spot-drawer__field-label {
  font-size: 14px;
  color: #1f1f1f;
  margin-bottom: 8px;
}
.spot-drawer__required {
  color: #ff4d4f;
  margin-right: 4px;
}
.spot-drawer__cover-upload :where(.ant-upload.ant-upload-select) {
  width: 180px;
  height: 130px;
  margin: 0;
  border: 1px dashed #d9d9d9;
  border-radius: 6px;
  background: #fafbfc;
}
.spot-drawer__cover-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.spot-drawer__cover-hint {
  font-size: 12px;
  color: #999;
  margin: 8px 0 0 0;
}
.spot-drawer__gallery {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 12px;
}
.spot-drawer__gallery-item {
  position: relative;
  aspect-ratio: 1 / 1;
  border-radius: 6px;
  overflow: hidden;
  background: #f0f0f0;
}
.spot-drawer__gallery-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.spot-drawer__gallery-remove {
  position: absolute;
  top: 4px;
  right: 4px;
  font-size: 18px;
  color: rgba(0, 0, 0, 0.55);
  background: #fff;
  border-radius: 50%;
  cursor: pointer;
}
.spot-drawer__gallery-add {
  aspect-ratio: 1 / 1;
  border: 1px dashed #d9d9d9;
  border-radius: 6px;
  background: #fafbfc;
  display: flex;
  align-items: center;
  justify-content: center;
}
.spot-drawer__gallery-add :where(.ant-upload) {
  width: 100%;
  height: 100%;
}
.spot-drawer__gallery-add-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}
`

export default SpotDrawer
