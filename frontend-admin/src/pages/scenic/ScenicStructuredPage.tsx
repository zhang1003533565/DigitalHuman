/* eslint-disable react-hooks/set-state-in-effect -- initial structured data is loaded from the backend on mount */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Button,
  Card,
  Drawer,
  Form,
  Input,
  Popconfirm,
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
  getScenicStructuredRecords,
  importScenicStructuredDocx,
  updateScenicStructuredRecord,
  type ScenicStructuredRecord,
  type ScenicStructuredRecordPayload,
} from '../../api/scenicStructured'

type DataRow = Record<string, string> & { key: string; __id: string }

const FIELDS: string[] = [
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
]

const LABELS: Record<string, string> = {
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
  return records.map((record) => {
    const row: DataRow = { key: String(record.id), __id: String(record.id) }
    FIELDS.forEach((field) => {
      row[field] = String((record as unknown as Record<string, unknown>)[field] ?? '')
    })
    return row
  })
}

function toPayload(values: Record<string, string>): ScenicStructuredRecordPayload {
  const payload = {} as ScenicStructuredRecordPayload
  FIELDS.forEach((field) => {
    ;(payload as unknown as Record<string, string>)[field] = String(values[field] ?? '').trim()
  })
  return payload
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
  const [form] = Form.useForm<Record<string, string>>()

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
    void loadRows()
  }, [loadRows])

  const columns: TableColumnsType<DataRow> = useMemo(() => {
    const businessColumns: TableColumnsType<DataRow> = FIELDS.map((field) => ({
      title: (
        <div>
          <div style={{ fontWeight: 700 }}>{LABELS[field] ?? field}</div>
          <div style={{ fontSize: 12, color: '#8c8c8c' }}>{field}</div>
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
              const initialValues: Record<string, string> = {}
              FIELDS.forEach((field) => {
                initialValues[field] = record[field] ?? ''
              })
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
        </Form>
      </Drawer>
    </div>
  )
}
