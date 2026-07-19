import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Checkbox,
  Drawer,
  Form,
  Input,
  Popconfirm,
  Radio,
  Select,
  Space,
  Table,
  Tag,
  Upload,
  message,
} from 'antd'
import type { TableColumnsType, UploadProps } from 'antd'
import { DeleteOutlined, EditOutlined, LinkOutlined, PlusOutlined, ReloadOutlined, UploadOutlined } from '@ant-design/icons'
import { getScenicFacilities, type ScenicFacility } from '../../api/scenic'
import {
  applyScenicStructuredRecord,
  type ScenicKnowledgePublication,
  createScenicStructuredRecord,
  deleteScenicStructuredRecord,
  getScenicKnowledgePublicationStatus,
  getScenicStructuredRecords,
  importScenicStructuredDocx,
  matchScenicStructuredRecord,
  previewScenicStructuredApply,
  updateScenicStructuredRecord,
  type ScenicStructuredApplyPreview,
  type ScenicStructuredRecord,
  type ScenicStructuredRecordPayload,
} from '../../api/scenicStructured'
import ScenicKnowledgePublishDrawer from './ScenicKnowledgePublishDrawer'
import {
  classifyPublicationStatusLoadFailure,
  getScenicKnowledgePrimaryAction,
  getScenicKnowledgeStatusPresentation,
} from './scenicKnowledgePublishState'

const fields = [
  ['scenic_name', '景区名称'],
  ['spot_id', '景点编码'],
  ['spot_name', '景点名称'],
  ['location', '具体位置'],
  ['architecture_landscape_params', '建筑/景观参数'],
  ['core_function', '核心功能'],
  ['cultural_connotation', '文化内涵'],
  ['detailed_introduction', '详细介绍'],
  ['highlights', '游玩亮点'],
  ['performance_open_info', '演艺/开放信息'],
  ['remark', '备注'],
] as const

type TextField = (typeof fields)[number][0]
type EditValues = Record<TextField, string>
type ApplyMode = 'fill_empty' | 'selected' | 'overwrite_all'
const SESSION_STORAGE_KEY = 'digitalhuman.admin.user'

const publicationStatusMeta: Record<NonNullable<ScenicKnowledgePublication['status']>, { color: string; text: string }> = {
  publishing: { color: 'processing', text: '发布中' },
  published: { color: 'success', text: '已发布' },
  outdated: { color: 'warning', text: '待重发' },
  failed: { color: 'error', text: '发布失败' },
  withdrawn: { color: 'default', text: '已撤回' },
}

function emptyValues(): EditValues {
  return Object.fromEntries(fields.map(([key]) => [key, ''])) as EditValues
}

function normalizePayload(values: EditValues): ScenicStructuredRecordPayload {
  return Object.fromEntries(fields.map(([key]) => [key, String(values[key] ?? '').trim()])) as unknown as ScenicStructuredRecordPayload
}

function readCurrentRole() {
  if (typeof window === 'undefined') return 'OBSERVER'
  const rawValue = window.sessionStorage.getItem(SESSION_STORAGE_KEY)
  if (!rawValue) return 'OBSERVER'
  try {
    const parsed = JSON.parse(rawValue) as { role?: string }
    return parsed.role === 'ADMIN' ? 'ADMIN' : 'OBSERVER'
  } catch {
    return 'OBSERVER'
  }
}

export default function ScenicStructuredPage() {
  const [rows, setRows] = useState<ScenicStructuredRecord[]>([])
  const [facilities, setFacilities] = useState<ScenicFacility[]>([])
  const [publicationStatuses, setPublicationStatuses] = useState<Record<number, ScenicKnowledgePublication | null>>({})
  const [publicationStatusErrors, setPublicationStatusErrors] = useState<Record<number, string | null>>({})
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [editing, setEditing] = useState<ScenicStructuredRecord | null | undefined>(undefined)
  const [applyingRecord, setApplyingRecord] = useState<ScenicStructuredRecord | null>(null)
  const [publishingRecord, setPublishingRecord] = useState<ScenicStructuredRecord | null>(null)
  const [facilityId, setFacilityId] = useState<number | undefined>()
  const [mode, setMode] = useState<ApplyMode>('fill_empty')
  const [preview, setPreview] = useState<ScenicStructuredApplyPreview | null>(null)
  const [selectedFields, setSelectedFields] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [editForm] = Form.useForm<EditValues>()
  const [role] = useState<'ADMIN' | 'OBSERVER'>(() => readCurrentRole())

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [records, officialFacilities] = await Promise.all([
        getScenicStructuredRecords(),
        getScenicFacilities(),
      ])
      setRows(records)
      setFacilities(officialFacilities)
      const appliedFacilityIds = [...new Set(records
        .filter((item) => item.applyStatus === 'applied' && item.matchedFacilityId)
        .map((item) => item.matchedFacilityId as number))]
      const statusEntries = await Promise.all(appliedFacilityIds.map(async (appliedFacilityId) => {
        try {
          return { facilityId: appliedFacilityId, publication: await getScenicKnowledgePublicationStatus(appliedFacilityId), error: null }
        } catch (error) {
          const failure = classifyPublicationStatusLoadFailure({
            status: error && typeof error === 'object' && 'response' in (error as Record<string, unknown>)
              ? ((error as { response?: { status?: number } }).response?.status ?? null)
              : null,
            message: error instanceof Error ? error.message : '状态加载失败',
          })
          return { facilityId: appliedFacilityId, publication: failure.kind === 'unpublished' ? null : undefined, error: failure.kind === 'error' ? failure.message : null }
        }
      }))
      setPublicationStatuses((current) => {
        const next = { ...current }
        for (const entry of statusEntries) {
          if (entry.publication !== undefined) {
            next[entry.facilityId] = entry.publication
          }
        }
        return next
      })
      setPublicationStatusErrors((current) => {
        const next = { ...current }
        for (const appliedFacilityId of appliedFacilityIds) {
          if (!(appliedFacilityId in next)) next[appliedFacilityId] = null
        }
        for (const entry of statusEntries) {
          next[entry.facilityId] = entry.error
        }
        return next
      })
    } catch {
      message.error('加载景点导入数据失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial API hydration owns the page loading state
    void loadData()
  }, [loadData])

  const facilityOptions = useMemo(() => facilities.map((facility) => ({
    value: facility.id,
    label: `${facility.name}${facility.spotCode ? ` · ${facility.spotCode}` : ''} · ${facility.categoryName}`,
  })), [facilities])

  const loadPreview = async (record: ScenicStructuredRecord, selectedFacilityId: number) => {
    setFacilityId(selectedFacilityId)
    setPreview(null)
    try {
      const result = await previewScenicStructuredApply(record.id, selectedFacilityId)
      setPreview(result)
      setSelectedFields(result.fields.filter((field) => field.changed).map((field) => field.key))
    } catch {
      message.error('加载字段差异失败')
    }
  }

  const openApply = (record: ScenicStructuredRecord) => {
    setApplyingRecord(record)
    setMode('fill_empty')
    setPreview(null)
    const matchedId = record.matchedFacilityId ?? facilities.find((item) =>
      Boolean(record.spot_id && item.spotCode?.toLowerCase() === record.spot_id.toLowerCase()),
    )?.id
    setFacilityId(matchedId)
    if (matchedId) void loadPreview(record, matchedId)
  }

  const saveMatch = async () => {
    if (!applyingRecord || !facilityId) return
    try {
      await matchScenicStructuredRecord(applyingRecord.id, facilityId)
      message.success('已匹配正式景点')
      await loadData()
    } catch { message.error('保存匹配失败') }
  }

  const applyRecord = async () => {
    if (!applyingRecord || !facilityId) return
    setSaving(true)
    try {
      await applyScenicStructuredRecord(applyingRecord.id, {
        facilityId,
        mode,
        fields: mode === 'selected' ? selectedFields : [],
      })
      message.success('结构化资料已应用到正式景点')
      setApplyingRecord(null)
      await loadData()
    } catch { message.error('应用资料失败，请检查字段或景点配置') } finally { setSaving(false) }
  }

  const uploadProps: UploadProps = {
    accept: '.docx',
    showUploadList: false,
    beforeUpload: async (file) => {
      setUploading(true)
      try {
        const result = await importScenicStructuredDocx(file as File, false)
        message.success(`已导入 ${result.importedCount} 条，跳过 ${result.skippedEmptyCount + result.skippedDuplicateCount} 条`)
        if (result.issues.length) message.warning(result.issues.slice(0, 3).map((item) => item.reason).join('；'))
        await loadData()
      } catch { message.error('DOCX 导入失败') } finally { setUploading(false) }
      return false
    },
  }

  const columns: TableColumnsType<ScenicStructuredRecord> = [
    { title: '景区', dataIndex: 'scenic_name', width: 150, ellipsis: true },
    { title: '景点编码', dataIndex: 'spot_id', width: 130 },
    { title: '景点名称', dataIndex: 'spot_name', width: 190, ellipsis: true },
    { title: '具体位置', dataIndex: 'location', width: 220, ellipsis: true },
    {
      title: '正式景点', width: 210,
      render: (_, record) => {
        const facility = facilities.find((item) => item.id === record.matchedFacilityId)
        return facility ? <span>{facility.name}<br /><small>{facility.spotCode || `ID ${facility.id}`}</small></span> : <Tag>未匹配</Tag>
      },
    },
    {
      title: '状态', width: 120,
      render: (_, record) => record.applyStatus === 'applied'
        ? <Tag color="success">已应用</Tag>
        : record.matchedFacilityId ? <Tag color="processing">待应用</Tag> : <Tag>待匹配</Tag>,
    },
    {
      title: '知识发布', width: 150,
      render: (_, record) => {
        const facilityPublication = record.matchedFacilityId ? publicationStatuses[record.matchedFacilityId] : null
        const statusLoadError = record.matchedFacilityId ? publicationStatusErrors[record.matchedFacilityId] : null
        const presentation = getScenicKnowledgeStatusPresentation({
          applyStatus: record.applyStatus,
          publication: facilityPublication,
          statusLoadError,
        })
        if (presentation.kind === 'publication' && facilityPublication?.status) {
          const meta = publicationStatusMeta[facilityPublication.status]
          return <Tag color={meta.color}>{meta.text}</Tag>
        }
        if (presentation.kind === 'error') return <Tag color="warning" title={presentation.detail}>状态加载失败</Tag>
        if (presentation.kind === 'unpublished') return <Tag>未发布</Tag>
        return <span className="structured-import__empty">{presentation.text}</span>
      },
    },
    {
      title: '操作', width: 360, fixed: 'right',
      render: (_, record) => {
        const publicationAction = getScenicKnowledgePrimaryAction(record.applyStatus, role)
        return (
          <Space>
            <Button type="link" icon={<LinkOutlined />} onClick={() => openApply(record)}>匹配正式景点</Button>
            {publicationAction === 'publish' ? (
              <Button type="link" onClick={() => setPublishingRecord(record)}>发布到知识库</Button>
            ) : null}
            {publicationAction === 'view' ? (
              <Button type="link" onClick={() => setPublishingRecord(record)}>查看知识状态</Button>
            ) : null}
            <Button type="link" icon={<EditOutlined />} onClick={() => {
              editForm.setFieldsValue(Object.fromEntries(fields.map(([key]) => [key, record[key] ?? ''])) as EditValues)
              setEditing(record)
            }}>编辑</Button>
            <Popconfirm title="确认删除该导入记录吗？" onConfirm={async () => { await deleteScenicStructuredRecord(record.id); await loadData() }}>
              <Button type="link" danger icon={<DeleteOutlined />} aria-label="删除导入记录" />
            </Popconfirm>
          </Space>
        )
      },
    },
  ]

  return (
    <div className="structured-import">
      <style>{styles}</style>
      <div className="structured-import__toolbar">
        <div>
          <h1>景点资料导入</h1>
          <p>导入数据先匹配正式景点，确认字段差异后再应用，不直接覆盖地图点位。</p>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => void loadData()}>刷新</Button>
          <Upload {...uploadProps}><Button icon={<UploadOutlined />} loading={uploading}>导入 DOCX</Button></Upload>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { editForm.setFieldsValue(emptyValues()); setEditing(null) }}>手工新增</Button>
        </Space>
      </div>

      <Alert type="info" showIcon title="这里保存的是导入来源。语音、直播和游客端展示请在正式设施的“内容配置”中维护。" />
      <Table rowKey="id" loading={loading} columns={columns} dataSource={rows} scroll={{ x: 1280 }} pagination={{ pageSize: 20 }} />

      <Drawer
        title={editing ? '编辑导入资料' : '新增导入资料'}
        open={editing !== undefined}
        size={720}
        onClose={() => setEditing(undefined)}
        forceRender
        extra={<Button type="primary" loading={saving} onClick={async () => {
          try {
            const values = await editForm.validateFields()
            setSaving(true)
            if (editing) await updateScenicStructuredRecord(editing.id, normalizePayload(values))
            else await createScenicStructuredRecord(normalizePayload(values))
            message.success('导入资料已保存')
            setEditing(undefined)
            await loadData()
          } finally { setSaving(false) }
        }}>保存</Button>}
      >
        <Form form={editForm} layout="vertical">
          {fields.map(([key, label]) => (
            <Form.Item key={key} name={key} label={label} rules={key === 'spot_id' ? [{ required: true, message: '请输入景点编码' }] : undefined}>
              {['architecture_landscape_params', 'core_function', 'cultural_connotation', 'detailed_introduction', 'highlights', 'performance_open_info', 'remark'].includes(key)
                ? <Input.TextArea rows={key === 'detailed_introduction' ? 6 : 3} />
                : <Input />}
            </Form.Item>
          ))}
        </Form>
      </Drawer>

      <Drawer
        title={applyingRecord ? `匹配并应用 · ${applyingRecord.spot_name}` : '匹配并应用'}
        open={Boolean(applyingRecord)}
        size={900}
        onClose={() => setApplyingRecord(null)}
        extra={<Space><Button disabled={!facilityId} onClick={() => void saveMatch()}>仅保存匹配</Button><Button type="primary" loading={saving} disabled={!preview} onClick={() => void applyRecord()}>应用资料</Button></Space>}
      >
        <div className="structured-import__apply">
          <label>匹配正式景点</label>
          <Select
            showSearch
            optionFilterProp="label"
            value={facilityId}
            options={facilityOptions}
            placeholder="选择现有正式景点"
            onChange={(value) => applyingRecord && void loadPreview(applyingRecord, value)}
          />
          <label>填充方式</label>
          <Radio.Group value={mode} onChange={(event) => setMode(event.target.value)} optionType="button" buttonStyle="solid">
            <Radio.Button value="fill_empty">仅填充空字段</Radio.Button>
            <Radio.Button value="selected">逐字段选择</Radio.Button>
            <Radio.Button value="overwrite_all">覆盖全部资料</Radio.Button>
          </Radio.Group>
          {mode === 'overwrite_all' ? <Alert type="warning" showIcon title="覆盖全部资料会替换已有内容，系统会保留应用前快照。" /> : null}
          {preview ? (
            <Table
              rowKey="key"
              pagination={false}
              dataSource={preview.fields}
              columns={[
                {
                  title: mode === 'selected' ? '选择' : '', width: 64,
                  render: (_, field) => mode === 'selected' ? (
                    <Checkbox checked={selectedFields.includes(field.key)} onChange={(event) => setSelectedFields((current) => event.target.checked ? [...current, field.key] : current.filter((key) => key !== field.key))} />
                  ) : null,
                },
                { title: '字段', dataIndex: 'label', width: 150 },
                { title: '当前正式数据', dataIndex: 'currentValue', render: (value) => value || <span className="structured-import__empty">空</span> },
                { title: '导入数据', dataIndex: 'importedValue', render: (value) => value || <span className="structured-import__empty">空</span> },
              ]}
            />
          ) : <div className="structured-import__placeholder">选择正式景点后查看字段差异</div>}
        </div>
      </Drawer>

      <ScenicKnowledgePublishDrawer
        key={`${publishingRecord?.id ?? 'none'}:${publishingRecord?.matchedFacilityId ?? 'none'}:${Boolean(publishingRecord)}`}
        open={Boolean(publishingRecord)}
        role={role}
        record={publishingRecord}
        facility={publishingRecord?.matchedFacilityId ? facilities.find((item) => item.id === publishingRecord.matchedFacilityId) ?? null : null}
        onClose={() => setPublishingRecord(null)}
        onUpdated={loadData}
      />
    </div>
  )
}

const styles = `
.structured-import { padding: 0 0 28px; }
.structured-import__toolbar { display:flex; align-items:flex-start; justify-content:space-between; gap:20px; margin-bottom:18px; }
.structured-import__toolbar h1 { margin:0 0 5px; font-size:24px; letter-spacing:0; }
.structured-import__toolbar p { margin:0; color:#697586; }
.structured-import > .ant-alert { margin-bottom:16px; }
.structured-import__apply { display:grid; gap:14px; }
.structured-import__apply > label { font-weight:600; margin-bottom:-6px; }
.structured-import__empty { color:#a0a8b3; }
.structured-import__placeholder { min-height:180px; display:grid; place-items:center; color:#8c96a5; border:1px dashed #d9dfe7; }
@media (max-width: 760px) { .structured-import__toolbar { flex-direction:column; } }
`
