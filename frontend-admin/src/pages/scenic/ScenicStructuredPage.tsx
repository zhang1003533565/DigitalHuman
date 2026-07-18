import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Divider,
  Drawer,
  Form,
  Input,
  Popconfirm,
  Radio,
  Select,
  Space,
  Switch,
  Table,
  Upload,
  message,
} from 'antd'
import type { TableColumnsType, UploadProps } from 'antd'
import { DeleteOutlined, DownloadOutlined, EditOutlined, PlusOutlined, ReloadOutlined, UploadOutlined } from '@ant-design/icons'
import {
  createScenicStructuredRecord,
  deleteScenicStructuredRecord,
  downloadScenicStructuredTemplate,
  getPublishedVoiceScripts,
  getScenicStructuredRecords,
  importScenicStructuredDocx,
  uploadScenicLiveVideo,
  updateScenicStructuredRecord,
  type ScenicStructuredRecord,
  type ScenicStructuredRecordPayload,
  type PublishedVoiceScript,
} from '../../api/scenicStructured'

type DataRow = ScenicStructuredRecord & { key: string; __id: string }

const FIELDS = [
  'scenic_name',
  'spot_id',
  'spot_name',
  'location',
  'architecture_landscape_params',
  'core_function',
  'cultural_connotation',
  'detailed_introduction',
  'highlights',
  'performance_open_info',
  'remark',
] as const

type StructuredTextField = (typeof FIELDS)[number]

const LABELS: Record<StructuredTextField, string> = {
  scenic_name: '景区名称',
  spot_id: '景点ID',
  spot_name: '景点名称',
  location: '具体位置',
  architecture_landscape_params: '建筑/景观参数',
  core_function: '核心功能',
  cultural_connotation: '文化内涵',
  detailed_introduction: '详细介绍',
  highlights: '游玩亮点',
  performance_open_info: '演艺/开放信息',
  remark: '备注',
}

function buildRows(records: ScenicStructuredRecord[]): DataRow[] {
  return records.map((record) => ({
    ...record,
    audio_enabled: Boolean(record.audio_enabled),
    live_enabled: Boolean(record.live_enabled),
    default_experience: record.default_experience ?? null,
    bound_voice_script_id: record.bound_voice_script_id ?? null,
    live_source_type: record.live_source_type ?? null,
    live_video_url: record.live_video_url ?? '',
    live_stream_url: record.live_stream_url ?? '',
    camera_stream_key: record.camera_stream_key ?? '',
    key: String(record.id),
    __id: String(record.id),
  }))
}

function toPayload(values: ScenicStructuredRecordPayload): ScenicStructuredRecordPayload {
  const payload = { ...values }
  FIELDS.forEach((field) => {
    ;(payload as unknown as Record<string, string>)[field] = String(values[field] ?? '').trim()
  })
  payload.audio_enabled = Boolean(values.audio_enabled)
  payload.live_enabled = Boolean(values.live_enabled)
  payload.default_experience = values.default_experience ?? null
  payload.bound_voice_script_id = payload.audio_enabled ? (values.bound_voice_script_id ?? null) : null
  payload.live_source_type = payload.live_enabled ? (values.live_source_type ?? null) : null
  payload.live_video_url = payload.live_enabled && payload.live_source_type === 'video'
    ? String(values.live_video_url ?? '').trim()
    : ''
  payload.live_stream_url = payload.live_enabled && payload.live_source_type === 'stream'
    ? String(values.live_stream_url ?? '').trim()
    : ''
  payload.camera_stream_key = payload.live_enabled && payload.live_source_type === 'camera'
    ? String(values.camera_stream_key ?? '').trim()
    : ''
  if (!payload.audio_enabled && !payload.live_enabled) {
    payload.default_experience = null
  }
  return payload
}

const PRESENTATION_DEFAULTS: Pick<
  ScenicStructuredRecordPayload,
  | 'audio_enabled'
  | 'live_enabled'
  | 'default_experience'
  | 'bound_voice_script_id'
  | 'live_source_type'
  | 'live_video_url'
  | 'live_stream_url'
  | 'camera_stream_key'
> = {
  audio_enabled: false,
  live_enabled: false,
  default_experience: null,
  bound_voice_script_id: null,
  live_source_type: null,
  live_video_url: '',
  live_stream_url: '',
  camera_stream_key: '',
}

const longTextFields = new Set([
  'architecture_landscape_params',
  'core_function',
  'cultural_connotation',
  'detailed_introduction',
  'highlights',
  'performance_open_info',
  'remark',
])

export default function ScenicStructuredPage() {
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [downloadingTemplate, setDownloadingTemplate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [replaceAll, setReplaceAll] = useState(true)
  const [rows, setRows] = useState<DataRow[]>([])
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingRow, setEditingRow] = useState<DataRow | null>(null)
  const [publishedScriptResult, setPublishedScriptResult] = useState<{
    spotId: string
    scripts: PublishedVoiceScript[]
  }>({ spotId: '', scripts: [] })
  const [checkingCamera, setCheckingCamera] = useState(false)
  const [uploadingLiveVideo, setUploadingLiveVideo] = useState(false)
  const [form] = Form.useForm<ScenicStructuredRecordPayload>()
  const audioEnabled = Form.useWatch('audio_enabled', form) ?? false
  const liveEnabled = Form.useWatch('live_enabled', form) ?? false
  const liveSourceType = Form.useWatch('live_source_type', form)
  const watchedSpotId = Form.useWatch('spot_id', form)
  const publishedSpotId = drawerOpen && audioEnabled ? String(watchedSpotId ?? '').trim() : ''
  const publishedScripts = publishedScriptResult.spotId === publishedSpotId ? publishedScriptResult.scripts : []
  const loadingPublishedScripts = Boolean(publishedSpotId) && publishedScriptResult.spotId !== publishedSpotId

  useEffect(() => {
    const spotId = publishedSpotId
    if (!spotId || publishedScriptResult.spotId === spotId) {
      return
    }

    let cancelled = false
    void getPublishedVoiceScripts(spotId)
      .then((scripts) => {
        if (!cancelled) {
          setPublishedScriptResult({ spotId, scripts })
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPublishedScriptResult({ spotId, scripts: [] })
          message.error('加载可绑定口播失败')
        }
      })

    return () => {
      cancelled = true
    }
  }, [publishedScriptResult.spotId, publishedSpotId])

  const loadRows = useCallback(async () => {
    setLoading(true)
    try {
      const records = await getScenicStructuredRecords()
      setRows(buildRows(records))
    } catch {
      message.error('加载景点结构化数据失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial backend fetch updates the table request state
    void loadRows()
  }, [loadRows])

  const columns: TableColumnsType<DataRow> = useMemo(() => {
    const businessColumns: TableColumnsType<DataRow> = FIELDS.map((field) => ({
      title: (
        <div>
          <div style={{ fontWeight: 700 }}>{LABELS[field] ?? field}</div>
          <div style={{ fontSize: 13, color: '#8c8c8c' }}>{field}</div>
        </div>
      ),
      dataIndex: field,
      key: field,
      width: longTextFields.has(field) ? 320 : 220,
      ellipsis: true,
    }))

    businessColumns.push({
      title: '操作',
      key: '__actions',
      width: 180,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => {
              const initialValues = { ...PRESENTATION_DEFAULTS } as ScenicStructuredRecordPayload
              FIELDS.forEach((field) => {
                ;(initialValues as unknown as Record<string, string>)[field] = String(
                  (record as unknown as Record<string, unknown>)[field] ?? '',
                )
              })
              initialValues.audio_enabled = record.audio_enabled
              initialValues.live_enabled = record.live_enabled
              initialValues.default_experience = record.default_experience
              initialValues.bound_voice_script_id = record.bound_voice_script_id
              initialValues.live_source_type = record.live_source_type
              initialValues.live_video_url = record.live_video_url
              initialValues.live_stream_url = record.live_stream_url
              initialValues.camera_stream_key = record.camera_stream_key
              form.setFieldsValue(initialValues)
              setEditingRow(record)
              setDrawerOpen(true)
            }}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除该条记录吗？"
            okText="删除"
            cancelText="取消"
            onConfirm={async () => {
              try {
                await deleteScenicStructuredRecord(Number(record.__id))
                message.success('删除成功')
                await loadRows()
              } catch {
                message.error('删除失败')
              }
            }}
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    })

    return businessColumns
  }, [form, loadRows])

  const uploadProps: UploadProps = {
    accept: '.docx',
    showUploadList: false,
    beforeUpload: async (file) => {
      setUploading(true)
      try {
        const result = await importScenicStructuredDocx(file as File, replaceAll)
        const issuePreview = result.issues.slice(0, 6).map((item) => `第${item.rowNumber}行：${item.reason}`).join('\n')
        message.success(
          `导入完成：成功 ${result.importedCount}，空行跳过 ${result.skippedEmptyCount}，重复跳过 ${result.skippedDuplicateCount}，当前总计 ${result.totalCount}`,
          5,
        )
        if (issuePreview) {
          message.warning(`导入问题预览：\n${issuePreview}`, 8)
        }
        await loadRows()
      } catch {
        message.error('导入失败，请检查DOCX表头和数据格式')
      } finally {
        setUploading(false)
      }
      return false
    },
  }

  const handleSubmitRecord = async () => {
    try {
      const values = await form.validateFields()
      const payload = toPayload(values)
      setSaving(true)
      if (editingRow) {
        await updateScenicStructuredRecord(Number(editingRow.__id), payload)
        message.success('更新成功')
      } else {
        await createScenicStructuredRecord(payload)
        message.success('新增成功')
      }
      setDrawerOpen(false)
      setEditingRow(null)
      form.resetFields()
      await loadRows()
    } catch (error) {
      if ((error as { errorFields?: unknown[] })?.errorFields) {
        return
      }
      message.error('保存失败，请检查字段填写')
    } finally {
      setSaving(false)
    }
  }

  const handleDownloadTemplate = async () => {
    setDownloadingTemplate(true)
    try {
      const blob = await downloadScenicStructuredTemplate()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'scenic_structured_template.docx'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      message.success('模板下载成功')
    } catch {
      message.error('模板下载失败')
    } finally {
      setDownloadingTemplate(false)
    }
  }

  const handleCameraPermissionCheck = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      message.error('当前浏览器不支持摄像头权限检测')
      return
    }
    setCheckingCamera(true)
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true })
      mediaStream.getTracks().forEach((track) => track.stop())
      message.success('摄像头权限检测通过；仅完成权限检测，真实直播仍需配置 WebRTC/直播网关推流通道', 6)
    } catch {
      message.error('摄像头权限检测失败，请检查浏览器权限和设备状态')
    } finally {
      setCheckingCamera(false)
    }
  }

  const handleLiveVideoUpload = async (file: File) => {
    if (file.type && !file.type.startsWith('video/')) {
      message.error('请选择视频文件')
      return false
    }
    setUploadingLiveVideo(true)
    try {
      const result = await uploadScenicLiveVideo(file as File)
      if (!result.url?.trim()) {
        throw new Error('上传接口未返回视频地址')
      }
      form.setFieldValue('live_video_url', result.url)
      message.success('视频上传成功，已自动填入视频地址')
    } catch {
      message.error('视频上传失败，请稍后重试或手工填写视频地址')
    } finally {
      setUploadingLiveVideo(false)
    }
    return false
  }

  return (
    <div className="admin-panel-grid travel-analytics-page">
      <Card
        title="景点结构化数据（DOCX）"
        className="travel-analytics-card"
        extra={(
          <Space>
            <span>覆盖导入</span>
            <Switch checked={replaceAll} onChange={setReplaceAll} checkedChildren="是" unCheckedChildren="否" />
            <Upload {...uploadProps}>
              <Button icon={<UploadOutlined />} loading={uploading}>
                导入DOCX
              </Button>
            </Upload>
            <Button icon={<DownloadOutlined />} loading={downloadingTemplate} onClick={() => void handleDownloadTemplate()}>
              下载模板
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditingRow(null)
                form.resetFields()
                form.setFieldsValue(PRESENTATION_DEFAULTS)
                setDrawerOpen(true)
              }}
            >
              新增记录
            </Button>
            <Button icon={<ReloadOutlined />} onClick={() => void loadRows()} loading={loading}>
              刷新
            </Button>
          </Space>
        )}
      >
        <Table
          columns={columns}
          dataSource={rows}
          loading={loading}
          tableLayout="fixed"
          scroll={{ x: 3600, y: 'calc(100vh - 280px)' }}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50'],
            position: ['bottomLeft'],
          }}
        />
      </Card>

      <Drawer
        title={editingRow ? '编辑景点结构化记录' : '新增景点结构化记录'}
        width={820}
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false)
          setEditingRow(null)
        }}
        destroyOnClose
        extra={(
          <Space>
            <Button
              onClick={() => {
                setDrawerOpen(false)
                setEditingRow(null)
              }}
            >
              取消
            </Button>
            <Button type="primary" loading={saving} onClick={() => void handleSubmitRecord()}>
              保存
            </Button>
          </Space>
        )}
      >
        <Form form={form} layout="vertical">
          {FIELDS.map((field) => (
            <Form.Item
              key={field}
              label={`${LABELS[field] ?? field} (${field})`}
              name={field}
              rules={field === 'spot_id' ? [{ required: true, message: '景点ID不能为空' }] : undefined}
            >
              {longTextFields.has(field) ? (
                <Input.TextArea rows={4} placeholder={`请输入 ${LABELS[field] ?? field}`} />
              ) : (
                <Input placeholder={`请输入 ${LABELS[field] ?? field}`} />
              )}
            </Form.Item>
          ))}

          <Divider titlePlacement="start">游客呈现</Divider>

          <Space size={32} wrap>
            <Form.Item label="语音讲解" name="audio_enabled" valuePropName="checked">
              <Switch
                checkedChildren="开启"
                unCheckedChildren="关闭"
                onChange={(checked) => {
                  const currentDefault = form.getFieldValue('default_experience')
                  form.setFieldsValue({
                    audio_enabled: checked,
                    bound_voice_script_id: checked ? form.getFieldValue('bound_voice_script_id') : null,
                    default_experience: checked
                      ? (currentDefault ?? 'audio')
                      : (currentDefault === 'audio' ? (form.getFieldValue('live_enabled') ? 'live' : null) : currentDefault),
                  })
                }}
              />
            </Form.Item>
            <Form.Item label="直播讲解" name="live_enabled" valuePropName="checked">
              <Switch
                checkedChildren="开启"
                unCheckedChildren="关闭"
                onChange={(checked) => {
                  const currentDefault = form.getFieldValue('default_experience')
                  form.setFieldsValue({
                    live_enabled: checked,
                    default_experience: checked
                      ? (currentDefault ?? 'live')
                      : (currentDefault === 'live' ? (form.getFieldValue('audio_enabled') ? 'audio' : null) : currentDefault),
                  })
                }}
              />
            </Form.Item>
          </Space>

          {audioEnabled && (
            <Form.Item
              label="绑定口播"
              name="bound_voice_script_id"
              extra="仅显示该景点已发布且音频可用的口播"
              rules={[{ required: true, message: '启用语音后必须绑定一条可用口播' }]}
            >
              <Select
                showSearch
                optionFilterProp="label"
                loading={loadingPublishedScripts}
                disabled={!String(watchedSpotId ?? '').trim()}
                placeholder={watchedSpotId ? '请选择已发布口播' : '请先填写景点ID'}
                notFoundContent={loadingPublishedScripts ? '加载中...' : '暂无可绑定口播，请先合成并发布'}
                options={publishedScripts.map((script) => ({
                  value: script.id,
                  label: `${script.title} · v${script.versionNo} · ${script.durationSec}秒`,
                }))}
              />
            </Form.Item>
          )}

          {liveEnabled && (
            <>
              <Form.Item
                label="直播来源"
                name="live_source_type"
                rules={[{ required: true, message: '启用直播后必须选择直播来源' }]}
              >
                <Radio.Group
                  optionType="button"
                  buttonStyle="solid"
                  onChange={() => {
                    form.setFieldsValue({ live_video_url: '', live_stream_url: '', camera_stream_key: '' })
                  }}
                  options={[
                    { value: 'video', label: '上传视频' },
                    { value: 'stream', label: '播放流' },
                    { value: 'camera', label: '摄像头推流' },
                  ]}
                />
              </Form.Item>

              {liveSourceType === 'video' && (
                <>
                  <Form.Item label="视频文件" extra="上传成功后会自动回填视频地址">
                    <Upload
                      accept="video/*"
                      showUploadList={false}
                      beforeUpload={(file) => handleLiveVideoUpload(file as File)}
                    >
                      <Button icon={<UploadOutlined />} loading={uploadingLiveVideo}>
                        上传视频文件
                      </Button>
                    </Upload>
                  </Form.Item>
                  <Form.Item
                    label="视频地址"
                    name="live_video_url"
                    extra="也可以手工填写或修改视频地址"
                    rules={[
                      { required: true, message: '上传视频模式必须上传文件或填写视频地址' },
                      {
                        validator: (_, value) => !value || /^(https?:\/\/|\/)/i.test(value)
                          ? Promise.resolve()
                          : Promise.reject(new Error('请输入有效的视频地址')),
                      },
                    ]}
                  >
                    <Input placeholder="https://.../scenic-video.mp4" />
                  </Form.Item>
                </>
              )}

              {liveSourceType === 'stream' && (
                <Form.Item
                  label="播放流地址"
                  name="live_stream_url"
                  rules={[
                    { required: true, message: '播放流模式必须填写流地址' },
                    {
                      validator: (_, value) => !value || /^(https?|rtmp|rtmps|webrtc):\/\//i.test(value)
                        ? Promise.resolve()
                        : Promise.reject(new Error('请输入有效的播放流地址')),
                    },
                  ]}
                >
                  <Input placeholder="https://.../live.m3u8 或 rtmp://..." />
                </Form.Item>
              )}

              {liveSourceType === 'camera' && (
                <>
                  <Form.Item
                    label="摄像头推流通道"
                    name="camera_stream_key"
                    extra="用于连接独立 WebRTC 或直播网关；检测摄像头不会自动开始直播"
                    rules={[{ required: true, message: '摄像头推流必须配置推流通道' }]}
                  >
                    <Input placeholder="请输入直播网关分配的通道标识" />
                  </Form.Item>
                  <Button loading={checkingCamera} onClick={() => void handleCameraPermissionCheck()}>
                    检测摄像头权限
                  </Button>
                </>
              )}
            </>
          )}

          {(audioEnabled || liveEnabled) && (
            <Form.Item
              label="默认入口"
              name="default_experience"
              dependencies={['audio_enabled', 'live_enabled']}
              rules={[
                { required: true, message: '请选择默认入口' },
                {
                  validator: (_, value) => {
                    if ((value === 'audio' && audioEnabled) || (value === 'live' && liveEnabled)) {
                      return Promise.resolve()
                    }
                    return Promise.reject(new Error('默认入口必须是已启用的体验'))
                  },
                },
              ]}
            >
              <Radio.Group>
                <Radio.Button value="audio" disabled={!audioEnabled}>语音讲解</Radio.Button>
                <Radio.Button value="live" disabled={!liveEnabled}>直播讲解</Radio.Button>
              </Radio.Group>
            </Form.Item>
          )}

          {audioEnabled && liveEnabled && (
            <Alert
              type="info"
              showIcon
              message="语音与直播同时开放"
              description="游客可自行选择入口；直播不可用时将自动回退到语音讲解。"
            />
          )}
        </Form>
      </Drawer>
    </div>
  )
}
