import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Button,
  Card,
  Drawer,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Upload,
  message,
} from 'antd'
import type { TableColumnsType, UploadProps } from 'antd'
import { DeleteOutlined, EditOutlined, ReloadOutlined, UploadOutlined } from '@ant-design/icons'
import {
  createVoiceScriptRecord,
  deleteVoiceScriptRecord,
  getVoiceScriptRecords,
  importVoiceScriptDocx,
  publishVoiceScriptRecord,
  updateVoiceScriptRecord,
  type VoiceScriptScene,
  type VoiceScriptScenePayload,
} from '../../api/voiceScripts'

type Row = VoiceScriptScene & { key: string }

const sceneTypeOptions = [
  { value: 'overview', label: '总览长播' },
  { value: 'spot', label: '景点长播' },
  { value: 'transition', label: '转场短播' },
]

const styleOptions = [
  { value: 'culture', label: '文化版' },
  { value: 'family', label: '亲子版' },
  { value: 'light', label: '轻松版' },
]

const statusOptions = [
  { value: 'draft', label: '草稿' },
  { value: 'published', label: '已发布' },
  { value: 'archived', label: '已归档' },
]

export default function VoiceScriptPage() {
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<Row | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [uploadScenicName, setUploadScenicName] = useState('灵山胜境')
  const [uploadStyle, setUploadStyle] = useState<'culture' | 'family' | 'light'>('culture')
  const [uploadVersion, setUploadVersion] = useState(1)
  const [form] = Form.useForm<VoiceScriptScenePayload>()

  const loadRows = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getVoiceScriptRecords()
      setRows(data.map((item) => ({ ...item, key: String(item.id) })))
    } catch {
      message.error('加载口播数据失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadRows()
  }, [loadRows])

  const uploadProps: UploadProps = {
    accept: '.docx',
    showUploadList: false,
    beforeUpload: async (file) => {
      if (!uploadScenicName.trim()) {
        message.warning('请先填写景区名称')
        return false
      }
      setUploading(true)
      try {
        const result = await importVoiceScriptDocx(file as File, uploadScenicName.trim(), uploadStyle, uploadVersion)
        const issuePreview = result.issues.slice(0, 6).map((it) => `第${it.rowNumber}行：${it.reason}`).join('\n')
        message.success(`导入完成：成功 ${result.importedCount}，跳过 ${result.skippedCount}，总计 ${result.totalCount}`)
        if (issuePreview) {
          message.warning(`导入问题：\n${issuePreview}`, 8)
        }
        await loadRows()
      } catch {
        message.error('DOCX导入失败，请检查文档格式')
      } finally {
        setUploading(false)
      }
      return false
    },
  }

  const columns: TableColumnsType<Row> = useMemo(
    () => [
      { title: '景区', dataIndex: 'scenicName', width: 140 },
      { title: '景点ID', dataIndex: 'spotId', width: 160 },
      { title: '景点', dataIndex: 'spotName', width: 180 },
      {
        title: '场景',
        dataIndex: 'sceneType',
        width: 120,
        render: (value: string) => sceneTypeOptions.find((v) => v.value === value)?.label ?? value,
      },
      {
        title: '风格',
        dataIndex: 'style',
        width: 100,
        render: (value: string) => styleOptions.find((v) => v.value === value)?.label ?? value,
      },
      { title: '标题', dataIndex: 'title', width: 220, ellipsis: true },
      { title: '时长(秒)', dataIndex: 'durationSec', width: 100 },
      { title: '版本', dataIndex: 'versionNo', width: 90 },
      {
        title: '状态',
        dataIndex: 'status',
        width: 100,
        render: (value: string) => {
          if (value === 'published') {
            return <Tag color="green">已发布</Tag>
          }
          if (value === 'archived') {
            return <Tag>已归档</Tag>
          }
          return <Tag color="orange">草稿</Tag>
        },
      },
      {
        title: '操作',
        key: 'actions',
        width: 260,
        fixed: 'right',
        render: (_, record) => (
          <Space>
            <Button
              type="link"
              icon={<EditOutlined />}
              onClick={() => {
                form.setFieldsValue({
                  scenicName: record.scenicName,
                  spotId: record.spotId,
                  spotName: record.spotName,
                  sceneType: record.sceneType,
                  style: record.style,
                  title: record.title,
                  scriptText: record.scriptText,
                  ssmlText: record.ssmlText,
                  durationSec: record.durationSec,
                  versionNo: record.versionNo,
                  status: record.status,
                  sourceFile: record.sourceFile,
                })
                setEditing(record)
                setDrawerOpen(true)
              }}
            >
              编辑
            </Button>
            <Button
              type="link"
              onClick={async () => {
                try {
                  await publishVoiceScriptRecord(record.id)
                  message.success('发布成功')
                  await loadRows()
                } catch {
                  message.error('发布失败')
                }
              }}
              disabled={record.status === 'published'}
            >
              发布
            </Button>
            <Popconfirm
              title="确认删除该条口播脚本吗？"
              okText="删除"
              cancelText="取消"
              onConfirm={async () => {
                try {
                  await deleteVoiceScriptRecord(record.id)
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
      },
    ],
    [form, loadRows],
  )

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)
      if (editing) {
        await updateVoiceScriptRecord(editing.id, values)
        message.success('更新成功')
      } else {
        await createVoiceScriptRecord(values)
        message.success('新增成功')
      }
      setDrawerOpen(false)
      setEditing(null)
      form.resetFields()
      await loadRows()
    } catch (error) {
      if ((error as { errorFields?: unknown[] })?.errorFields) {
        return
      }
      message.error('保存失败，请检查字段')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="admin-panel-grid travel-analytics-page">
      <Card
        title="景点口播管理"
        className="travel-analytics-card"
        extra={
          <Space wrap>
            <Input
              value={uploadScenicName}
              onChange={(e) => setUploadScenicName(e.target.value)}
              placeholder="景区名称，例如：灵山胜境"
              style={{ width: 220 }}
            />
            <Select
              value={uploadStyle}
              onChange={(value) => setUploadStyle(value)}
              options={styleOptions}
              style={{ width: 120 }}
            />
            <InputNumber min={1} value={uploadVersion} onChange={(value) => setUploadVersion(Number(value ?? 1))} />
            <Upload {...uploadProps}>
              <Button icon={<UploadOutlined />} loading={uploading}>
                上传DOCX生成草稿
              </Button>
            </Upload>
            <Button
              type="primary"
              onClick={() => {
                setEditing(null)
                form.setFieldsValue({
                  scenicName: uploadScenicName,
                  sceneType: 'spot',
                  style: uploadStyle,
                  versionNo: uploadVersion,
                  status: 'draft',
                  durationSec: 90,
                } as Partial<VoiceScriptScenePayload>)
                setDrawerOpen(true)
              }}
            >
              新增脚本
            </Button>
            <Button icon={<ReloadOutlined />} onClick={() => void loadRows()} loading={loading}>
              刷新
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={rows}
          loading={loading}
          tableLayout="fixed"
          scroll={{ x: 2200, y: 'calc(100vh - 280px)' }}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50'],
            position: ['bottomLeft'],
          }}
        />
      </Card>

      <Drawer
        title={editing ? '编辑口播脚本' : '新增口播脚本'}
        width={860}
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false)
          setEditing(null)
        }}
        destroyOnClose
        extra={
          <Space>
            <Button
              onClick={() => {
                setDrawerOpen(false)
                setEditing(null)
              }}
            >
              取消
            </Button>
            <Button type="primary" loading={saving} onClick={() => void handleSave()}>
              保存
            </Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical">
          <Form.Item name="scenicName" label="景区名称" rules={[{ required: true, message: '请输入景区名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="spotId" label="景点ID" rules={[{ required: true, message: '请输入景点ID' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="spotName" label="景点名称" rules={[{ required: true, message: '请输入景点名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="sceneType" label="场景类型" rules={[{ required: true, message: '请选择场景类型' }]}>
            <Select options={sceneTypeOptions} />
          </Form.Item>
          <Form.Item name="style" label="口播风格" rules={[{ required: true, message: '请选择口播风格' }]}>
            <Select options={styleOptions} />
          </Form.Item>
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="scriptText"
            label="口播文本"
            rules={[
              { required: true, message: '请输入口播文本' },
              { min: 100, message: '口播文本至少100字' },
              { max: 1200, message: '口播文本最多1200字' },
            ]}
          >
            <Input.TextArea rows={10} />
          </Form.Item>
          <Form.Item name="ssmlText" label="SSML文本（可选）">
            <Input.TextArea rows={8} />
          </Form.Item>
          <Form.Item name="durationSec" label="预计时长(秒)" rules={[{ required: true, message: '请输入时长' }]}>
            <InputNumber min={20} max={900} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="versionNo" label="版本号" rules={[{ required: true, message: '请输入版本号' }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="status" label="状态" rules={[{ required: true, message: '请选择状态' }]}>
            <Select options={statusOptions} />
          </Form.Item>
          <Form.Item name="sourceFile" label="来源文件">
            <Input />
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  )
}
