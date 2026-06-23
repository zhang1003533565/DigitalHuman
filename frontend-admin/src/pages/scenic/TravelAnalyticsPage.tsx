import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
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
  Tooltip,
  Typography,
  Upload,
  message,
  Progress,
} from 'antd'
import type { TableColumnsType, UploadProps } from 'antd'
import {
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import {
  createTravelAnalyticsRecord,
  deleteTravelAnalyticsRecord,
  downloadTravelAnalyticsTemplate,
  getTravelAnalyticsRecords,
  importTravelAnalyticsExcel,
  updateTravelAnalyticsRecord,
  type TravelAnalyticsRecord,
  type TravelAnalyticsRecordPayload,
} from '../../api/travelAnalytics'

type DataRow = Record<string, string> & { key: string; __id: string }

const FIELDS: string[] = [
  'tourist_id',
  'user_nickname',
  'age',
  'gender',
  'attraction_name',
  'attraction_content',
  'attraction_type',
  'visit_date',
  'stay_duration',
  'ticket_cost',
  'food_cost',
  'shopping_cost',
  'transport_cost',
  'entertainment_cost',
  'total_cost',
  'group_size',
  'satisfaction',
]

const LABELS: Record<string, string> = {
  tourist_id: '游客ID',
  user_nickname: '用户昵称',
  age: '年龄',
  gender: '性别',
  attraction_name: '景点名称',
  attraction_content: '景点内容',
  attraction_type: '景点类型',
  visit_date: '游览日期',
  stay_duration: '停留时长',
  ticket_cost: '门票费用',
  food_cost: '餐饮费用',
  shopping_cost: '购物费用',
  transport_cost: '交通费用',
  entertainment_cost: '娱乐费用',
  total_cost: '总费用',
  group_size: '同行人数',
  satisfaction: '满意度',
}

function buildRows(records: TravelAnalyticsRecord[]): DataRow[] {
  return records.map((record) => {
    const row: DataRow = { key: String(record.id), __id: String(record.id) }
    FIELDS.forEach((field) => {
      row[field] = String((record as unknown as Record<string, unknown>)[field] ?? '')
    })
    return row
  })
}

function toPayload(values: Record<string, string>): TravelAnalyticsRecordPayload {
  const payload = {} as TravelAnalyticsRecordPayload
  FIELDS.forEach((field) => {
    ;(payload as unknown as Record<string, string>)[field] = String(values[field] ?? '').trim()
  })
  return payload
}

function renderTruncatedCell(
  value: string,
  rowHeight: number,
  fontSize: number,
  rowKey: string,
  onRowResizeStart: (event: ReactMouseEvent<HTMLDivElement>, rowKey: string, currentHeight: number) => void,
) {
  const text = (value ?? '').toString()
  const lineHeight = Math.max(18, fontSize + 6)
  const maxLines = Math.max(1, Math.floor(rowHeight / lineHeight))
  const content = (
    <div
      style={{
        position: 'relative',
        minHeight: rowHeight,
        paddingBottom: 6,
        fontSize,
        lineHeight: `${lineHeight}px`,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        display: '-webkit-box',
        WebkitLineClamp: maxLines,
        WebkitBoxOrient: 'vertical',
        whiteSpace: 'normal',
        wordBreak: 'break-word',
        cursor: 'pointer',
      }}
    >
      {text || '-'}
      <div
        role="separator"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: -3,
          height: 8,
          cursor: 'row-resize',
          zIndex: 3,
        }}
        onMouseDown={(event) => {
          event.stopPropagation()
          onRowResizeStart(event, rowKey, rowHeight)
        }}
      />
    </div>
  )

  if (text.length <= 30) {
    return content
  }
  return (
    <Tooltip
      placement="topLeft"
      title={<div style={{ maxWidth: 900, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{text || '-'}</div>}
    >
      {content}
    </Tooltip>
  )
}

export default function TravelAnalyticsPage() {
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [importStage, setImportStage] = useState<'idle' | 'uploading' | 'processing' | 'done'>('idle')
  const [downloadingTemplate, setDownloadingTemplate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [replaceAll, setReplaceAll] = useState(true)
  const [rows, setRows] = useState<DataRow[]>([])
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 })
  const [fontSize] = useState(16)
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({})
  const [rowHeights, setRowHeights] = useState<Record<string, number>>({})
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingRow, setEditingRow] = useState<DataRow | null>(null)
  const [form] = Form.useForm<Record<string, string>>()
  const tableScrollY = 'calc(100vh - 280px)'

  const colDragRef = useRef<{ field: string; startX: number; startWidth: number } | null>(null)
  const rowDragRef = useRef<{ rowKey: string; startY: number; startHeight: number } | null>(null)

  const loadRows = useCallback(async (page = 1, pageSize = 20) => {
    setLoading(true)
    try {
      const result = await getTravelAnalyticsRecords(page - 1, pageSize)
      setRows(buildRows(result.records))
      setPagination({
        current: result.page + 1,
        pageSize: result.size,
        total: result.total,
      })
    } catch {
      message.error('加载旅游行为分析数据失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadRows()
  }, [loadRows])

  useEffect(() => {
    function onMouseMove(event: MouseEvent) {
      if (colDragRef.current) {
        const { field, startX, startWidth } = colDragRef.current
        const nextWidth = Math.max(140, startWidth + event.clientX - startX)
        setColumnWidths((prev) => ({ ...prev, [field]: nextWidth }))
        return
      }
      if (rowDragRef.current) {
        const { rowKey, startY, startHeight } = rowDragRef.current
        const nextHeight = Math.max(44, startHeight + event.clientY - startY)
        setRowHeights((prev) => ({ ...prev, [rowKey]: nextHeight }))
      }
    }

    function onMouseUp() {
      colDragRef.current = null
      rowDragRef.current = null
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  const setRowHeightDragStart = (
    event: ReactMouseEvent<HTMLDivElement>,
    rowKey: string,
    currentHeight: number,
  ) => {
    event.preventDefault()
    rowDragRef.current = { rowKey, startY: event.clientY, startHeight: currentHeight }
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'row-resize'
  }

  const columns: TableColumnsType<DataRow> = useMemo(() => {
    const businessColumns: TableColumnsType<DataRow> = FIELDS.map((field) => {
      const width = columnWidths[field] ?? 220
      return {
        title: (
          <div style={{ position: 'relative', paddingRight: 10 }}>
            <div style={{ fontWeight: 700 }}>{LABELS[field] ?? field}</div>
            <div style={{ fontSize: 12, color: '#8c8c8c' }}>{field}</div>
            <span
              role="separator"
              style={{
                position: 'absolute',
                right: -6,
                top: 0,
                width: 12,
                height: '100%',
                cursor: 'col-resize',
                zIndex: 2,
              }}
              onMouseDown={(event) => {
                event.preventDefault()
                colDragRef.current = { field, startX: event.clientX, startWidth: width }
                document.body.style.userSelect = 'none'
                document.body.style.cursor = 'col-resize'
              }}
            />
          </div>
        ),
        dataIndex: field,
        key: field,
        width,
        render: (value: string, record: DataRow) => {
          const rowKey = String(record.key ?? '')
          const rowHeight = rowHeights[rowKey] ?? 64
          return renderTruncatedCell(value, rowHeight, fontSize, rowKey, setRowHeightDragStart)
        },
      }
    })

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
                await deleteTravelAnalyticsRecord(Number(record.__id))
                message.success('删除成功')
                await loadRows(pagination.current, pagination.pageSize)
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
  }, [columnWidths, fontSize, form, loadRows, rowHeights])

  const uploadProps: UploadProps = {
    accept: '.xlsx',
    showUploadList: false,
    beforeUpload: async (file) => {
      setUploading(true)
      setUploadProgress(0)
      setImportStage('uploading')
      try {
        const result = await importTravelAnalyticsExcel(file as File, replaceAll, (percent) => {
          setUploadProgress(Math.min(percent, 100))
          if (percent >= 100) {
            setImportStage('processing')
          }
        })
        setImportStage('done')
        setUploadProgress(100)
        const issuePreview = result.issues.slice(0, 6).map((item) => `第${item.rowNumber}行：${item.reason}`).join('\n')
        message.success(
          `导入完成：成功 ${result.importedCount}，空行跳过 ${result.skippedEmptyCount}，重复跳过 ${result.skippedDuplicateCount}，当前总计 ${result.totalCount}`,
          5,
        )
        if (issuePreview) {
          message.warning(`导入问题预览：\n${issuePreview}`, 8)
        }
        await loadRows(1, pagination.pageSize)
      } catch {
        message.error('导入失败，请检查 Excel 表头和数据格式')
      } finally {
        setUploading(false)
        window.setTimeout(() => {
          setImportStage('idle')
          setUploadProgress(0)
        }, 1200)
      }
      return false
    },
  }

  const handleDownloadTemplate = async () => {
    setDownloadingTemplate(true)
    try {
      const blob = await downloadTravelAnalyticsTemplate()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'travel_analytics_template.xlsx'
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

  const handleSubmitRecord = async () => {
    try {
      const values = await form.validateFields()
      const payload = toPayload(values)
      setSaving(true)
      if (editingRow) {
        await updateTravelAnalyticsRecord(Number(editingRow.__id), payload)
        message.success('更新成功')
      } else {
        await createTravelAnalyticsRecord(payload)
        message.success('新增成功')
      }
      setDrawerOpen(false)
      setEditingRow(null)
      form.resetFields()
      await loadRows(editingRow ? pagination.current : 1, pagination.pageSize)
    } catch (error) {
      if ((error as { errorFields?: unknown[] })?.errorFields) {
        return
      }
      message.error('保存失败，请检查字段填写')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="admin-panel-grid travel-analytics-page">
      <Card
        title="旅游数据行为分析"
        className="travel-analytics-card"
        extra={(
          <Space>
            <span>覆盖导入</span>
            <Switch checked={replaceAll} onChange={setReplaceAll} checkedChildren="是" unCheckedChildren="否" />
            <Upload {...uploadProps}>
              <Button icon={<UploadOutlined />} loading={uploading}>
                导入Excel
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
        {importStage !== 'idle' && (
          <Card size="small" style={{ marginBottom: 16 }}>
            <Space direction="vertical" style={{ width: '100%' }} size={8}>
              <Typography.Text strong>
                {importStage === 'uploading' && '正在上传 Excel'}
                {importStage === 'processing' && '上传完成，正在解析并写入数据库'}
                {importStage === 'done' && '导入完成'}
              </Typography.Text>
              <Progress
                percent={importStage === 'processing' ? 99 : uploadProgress}
                status={importStage === 'done' ? 'success' : 'active'}
              />
              <Typography.Text type="secondary">
                {importStage === 'processing'
                  ? '服务端正在分批入库，大文件请稍等，不要刷新页面。'
                  : '上传进度会实时显示，上传完成后进入服务端处理阶段。'}
              </Typography.Text>
            </Space>
          </Card>
        )}
        <div className="travel-table-scroll">
          <Table
            className="travel-table"
            columns={columns}
            dataSource={rows}
            loading={loading}
            tableLayout="fixed"
            scroll={{ x: 3900, y: tableScrollY }}
            pagination={{
              current: pagination.current,
              pageSize: pagination.pageSize,
              total: pagination.total,
              showSizeChanger: true,
              pageSizeOptions: ['10', '20', '50'],
              position: ['bottomLeft'],
              showTotal: (total) => `共 ${total} 条`,
            }}
            onChange={(nextPagination) => {
              void loadRows(nextPagination.current ?? 1, nextPagination.pageSize ?? 20)
            }}
          />
        </div>
      </Card>

      <Drawer
        title={editingRow ? '编辑旅游行为记录' : '新增旅游行为记录'}
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
              rules={field === 'tourist_id' ? [{ required: true, message: 'tourist_id 不能为空' }] : undefined}
            >
              <Input placeholder={`请输入 ${LABELS[field] ?? field}`} />
            </Form.Item>
          ))}
        </Form>
      </Drawer>
    </div>
  )
}
