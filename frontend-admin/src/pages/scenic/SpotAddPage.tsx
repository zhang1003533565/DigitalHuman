import { useEffect, useRef, useState } from 'react'
import dayjs, { type Dayjs } from 'dayjs'
import {
  Button,
  Col,
  Drawer,
  Form,
  Input,
  Row,
  Select,
  TimePicker,
  Upload,
  message,
} from 'antd'
import type { UploadProps } from 'antd'
import { CloseCircleFilled, EnvironmentFilled, PlusOutlined } from '@ant-design/icons'
import {
  createScenicFacility,
  type ScenicCategory,
  type ScenicFacility,
  type ScenicFacilityPayload,
  updateScenicFacility,
} from '../../api/scenic'

const AMAP_KEY = '5b01b946c26d0f94f7d2ddb9d09ff26f'
const AMAP_SECURITY_KEY = '692196a068ef6c9cad53a55fc9e47ad7'
const LINGSHAN_CENTER: [number, number] = [120.1009, 31.4259]
const LINGSHAN_BOUNDS_SW: [number, number] = [120.0759, 31.4009]
const LINGSHAN_BOUNDS_NE: [number, number] = [120.1259, 31.4509]

declare global {
  interface Window {
    _AMapSecurityConfig?: { securityJsCode: string }
    AMap?: any
  }
}

let amapLoaderPromise: Promise<any> | null = null

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
    script.onerror = (error) => {
      amapLoaderPromise = null
      reject(error)
    }
    document.head.appendChild(script)
  })
  return amapLoaderPromise
}

type FacilityFormValues = {
  name: string
  categoryId: number
  longitude: string
  latitude: string
  image?: string
  openTime?: Dayjs
  closeTime?: Dayjs
}

export interface SpotDrawerProps {
  open: boolean
  onClose: () => void
  title?: string
  actionText?: string
  categories: ScenicCategory[]
  initialData?: ScenicFacility | null
  onSuccess?: () => void | Promise<void>
}

function SectionTitle({ title }: { title: string }) {
  return (
    <div className="spot-drawer__section-title">
      <span className="spot-drawer__section-bar" />
      <span>{title}</span>
    </div>
  )
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function SpotDrawer({
  open,
  onClose,
  title = '新增设施',
  actionText = '保存设施',
  categories,
  initialData,
  onSuccess,
}: SpotDrawerProps) {
  const [form] = Form.useForm<FacilityFormValues>()
  const [saving, setSaving] = useState(false)
  const [coverImage, setCoverImage] = useState('')
  const [galleryImages, setGalleryImages] = useState<string[]>([])
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const boundsRef = useRef<any>(null)

  const destroyMap = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.destroy?.()
      mapInstanceRef.current = null
    }
    markerRef.current = null
    boundsRef.current = null
  }

  useEffect(() => {
    return () => destroyMap()
  }, [])

  useEffect(() => {
    if (!open) {
      form.resetFields()
      setCoverImage('')
      setGalleryImages([])
      return
    }

    const longitude = initialData?.longitude ?? LINGSHAN_CENTER[0]
    const latitude = initialData?.latitude ?? LINGSHAN_CENTER[1]
    const currentCover = initialData?.image ?? ''
    const currentGallery = initialData?.galleryImages ?? []

    form.setFieldsValue({
      name: initialData?.name ?? '',
      categoryId: initialData?.categoryId,
      longitude: longitude.toFixed(6),
      latitude: latitude.toFixed(6),
      image: currentCover,
      openTime: initialData?.openTime ? dayjs(initialData.openTime, 'HH:mm:ss') : undefined,
      closeTime: initialData?.closeTime ? dayjs(initialData.closeTime, 'HH:mm:ss') : undefined,
    })
    setCoverImage(currentCover)
    setGalleryImages(currentGallery)
  }, [form, initialData, open])

  const coverUploadProps: UploadProps = {
    accept: '.png,.jpg,.jpeg,.webp',
    showUploadList: false,
    beforeUpload: async (file) => {
      const result = await readFileAsDataUrl(file)
      setCoverImage(result)
      form.setFieldValue('image', result)
      return false
    },
  }

  const galleryUploadProps: UploadProps = {
    accept: '.png,.jpg,.jpeg,.webp',
    showUploadList: false,
    multiple: true,
    beforeUpload: async (file) => {
      const result = await readFileAsDataUrl(file)
      setGalleryImages((current) => [...current, result].slice(0, 8))
      return false
    },
  }

  const updateLocationFields = (lng: number, lat: number) => {
    form.setFieldsValue({
      longitude: lng.toFixed(6),
      latitude: lat.toFixed(6),
    })
  }

  const setMarkerPosition = (lng: number, lat: number) => {
    if (markerRef.current) {
      markerRef.current.setPosition([lng, lat])
    }
    updateLocationFields(lng, lat)
  }

  const initAMap = () => {
    if (mapInstanceRef.current || !mapContainerRef.current) return

    loadAMap()
      .then((AMap) => {
        if (!mapContainerRef.current || !document.body.contains(mapContainerRef.current) || mapInstanceRef.current) {
          return
        }

        const sw = new AMap.LngLat(LINGSHAN_BOUNDS_SW[0], LINGSHAN_BOUNDS_SW[1])
        const ne = new AMap.LngLat(LINGSHAN_BOUNDS_NE[0], LINGSHAN_BOUNDS_NE[1])
        const bounds = new AMap.Bounds(sw, ne)
        boundsRef.current = bounds

        const initialLng = initialData?.longitude ?? LINGSHAN_CENTER[0]
        const initialLat = initialData?.latitude ?? LINGSHAN_CENTER[1]
        const map = new AMap.Map(mapContainerRef.current, {
          zoom: 15,
          center: [initialLng, initialLat],
          viewMode: '2D',
          zooms: [13, 19],
          mapStyle: 'amap://styles/normal',
        })
        map.setLimitBounds?.(bounds)
        mapInstanceRef.current = map

        const marker = new AMap.Marker({
          position: [initialLng, initialLat],
          draggable: true,
          cursor: 'move',
          map,
        })
        markerRef.current = marker
        updateLocationFields(initialLng, initialLat)

        map.on('click', (event: any) => {
          const lngLat = event?.lnglat
          if (!lngLat) return
          if (boundsRef.current && !boundsRef.current.contains(lngLat)) {
            message.warning('请在景区范围内选点')
            return
          }
          setMarkerPosition(lngLat.getLng(), lngLat.getLat())
        })

        marker.on('dragend', (event: any) => {
          const lngLat = event?.lnglat ?? marker.getPosition()
          if (!lngLat) return
          if (boundsRef.current && !boundsRef.current.contains(lngLat)) {
            message.warning('请在景区范围内选点')
            setMarkerPosition(LINGSHAN_CENTER[0], LINGSHAN_CENTER[1])
            return
          }
          updateLocationFields(lngLat.getLng(), lngLat.getLat())
        })
      })
      .catch(() => {
        message.error('地图加载失败')
      })
  }

  const handleResetCenter = () => {
    mapInstanceRef.current?.setZoomAndCenter?.(15, LINGSHAN_CENTER)
    setMarkerPosition(LINGSHAN_CENTER[0], LINGSHAN_CENTER[1])
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      const payload: ScenicFacilityPayload = {
        name: values.name.trim(),
        categoryId: values.categoryId,
        longitude: Number(values.longitude),
        latitude: Number(values.latitude),
        image: coverImage || values.image?.trim() || null,
        galleryImages,
        openTime: values.openTime ? values.openTime.format('HH:mm:ss') : null,
        closeTime: values.closeTime ? values.closeTime.format('HH:mm:ss') : null,
      }

      setSaving(true)
      if (initialData) {
        await updateScenicFacility(initialData.id, payload)
        message.success('设施更新成功')
      } else {
        await createScenicFacility(payload)
        message.success('设施创建成功')
      }
      onClose()
      await onSuccess?.()
    } catch (error) {
      if ((error as { errorFields?: unknown[] })?.errorFields) {
        return
      }
      if (error instanceof Error) {
        message.error(error.message)
      } else {
        message.error('保存设施失败')
      }
    } finally {
      setSaving(false)
    }
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
        else destroyMap()
      }}
    >
      <div className="spot-drawer">
        <style>{styles}</style>

        <div className="spot-drawer__topbar">
          <h1 className="spot-drawer__title">{title}</h1>
          <div className="spot-drawer__topbar-actions">
            <Button onClick={onClose} size="large">
              取消
            </Button>
            <Button type="primary" size="large" loading={saving} onClick={() => void handleSubmit()}>
              {actionText}
            </Button>
          </div>
        </div>

        <Row gutter={16} className="spot-drawer__row">
          <Col xs={24} lg={10}>
            <div className="spot-drawer__card">
              <SectionTitle title="基础信息" />
              <Form form={form} layout="vertical">
                <Form.Item label="设施名称" name="name" rules={[{ required: true, message: '请输入设施名称' }]}>
                  <Input placeholder="请输入设施名称" />
                </Form.Item>

                <Form.Item label="设施分类" name="categoryId" rules={[{ required: true, message: '请选择设施分类' }]}>
                  <Select
                    placeholder="请选择设施分类"
                    options={categories.map((item) => ({ value: item.id, label: item.name }))}
                  />
                </Form.Item>

                <Form.Item label="经度" name="longitude" rules={[{ required: true, message: '请在右侧地图选点' }]}>
                  <Input readOnly placeholder="请在右侧地图选点" />
                </Form.Item>

                <Form.Item label="纬度" name="latitude" rules={[{ required: true, message: '请在右侧地图选点' }]}>
                  <Input readOnly placeholder="请在右侧地图选点" />
                </Form.Item>

                <Form.Item label="开放时间">
                  <Row gutter={8} align="middle">
                    <Col flex="1">
                      <Form.Item name="openTime" noStyle>
                        <TimePicker style={{ width: '100%' }} format="HH:mm" placeholder="09:00" />
                      </Form.Item>
                    </Col>
                    <Col flex="0 0 24px" style={{ textAlign: 'center', color: '#666' }}>
                      至
                    </Col>
                    <Col flex="1">
                      <Form.Item name="closeTime" noStyle>
                        <TimePicker style={{ width: '100%' }} format="HH:mm" placeholder="17:00" />
                      </Form.Item>
                    </Col>
                  </Row>
                </Form.Item>

                <Form.Item label="封面地址" name="image">
                  <Input placeholder="可以手动输入封面地址，也可以在下方上传" />
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
              <p className="spot-drawer__map-hint">在地图上点击或拖动标记选择位置，仅可在景区范围内选点。</p>
            </div>
          </Col>
        </Row>

        <div className="spot-drawer__card spot-drawer__row">
          <SectionTitle title="图片信息" />
          <Row gutter={32}>
            <Col flex="0 0 200px">
              <div className="spot-drawer__field-label">
                <span className="spot-drawer__required">*</span>封面图片
              </div>
              <Upload
                {...coverUploadProps}
                listType="picture-card"
                className="spot-drawer__cover-upload"
              >
                {coverImage ? (
                  <img src={coverImage} alt="封面图片" className="spot-drawer__cover-image" />
                ) : (
                  <div className="spot-drawer__cover-inner">
                    <PlusOutlined style={{ fontSize: 22, color: '#1677ff' }} />
                    <div style={{ marginTop: 8, color: '#1677ff' }}>上传封面</div>
                  </div>
                )}
              </Upload>
              <p className="spot-drawer__cover-hint">建议尺寸：1200×675px，JPG/PNG/WEBP</p>
            </Col>

            <Col flex="1 1 0" style={{ minWidth: 0 }}>
              <div className="spot-drawer__field-label">景点图集</div>
              <div className="spot-drawer__gallery">
                {galleryImages.map((item, index) => (
                  <div key={`${item}-${index}`} className="spot-drawer__gallery-item">
                    <img src={item} alt="图集图片" />
                    <CloseCircleFilled
                      className="spot-drawer__gallery-remove"
                      onClick={() => setGalleryImages((current) => current.filter((_, currentIndex) => currentIndex !== index))}
                    />
                  </div>
                ))}
                {galleryImages.length < 8 ? (
                  <div className="spot-drawer__gallery-add">
                    <Upload {...galleryUploadProps}>
                      <div className="spot-drawer__gallery-add-inner">
                        <PlusOutlined style={{ fontSize: 22, color: '#999' }} />
                        <div style={{ marginTop: 6, color: '#666' }}>上传更多</div>
                      </div>
                    </Upload>
                  </div>
                ) : null}
              </div>
              <p className="spot-drawer__cover-hint">最多上传 8 张，支持 JPG/PNG/WEBP。</p>
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
  margin: 8px 0 0;
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
  overflow: hidden;
}
.spot-drawer__cover-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
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
  margin: 8px 0 0;
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
