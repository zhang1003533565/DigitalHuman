import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Divider,
  Drawer,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Segmented,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  message,
} from 'antd'
import type { TableColumnsType } from 'antd'
import {
  AudioOutlined,
  DeleteOutlined,
  EditOutlined,
  HistoryOutlined,
  PlusOutlined,
  ReloadOutlined,
  RobotOutlined,
} from '@ant-design/icons'
import axios from 'axios'
import {
  extractRecords,
  getKnowledgeDocuments,
  getKnowledges,
  listKnowledgeAccounts as getKnowledgeAccounts,
  type MaxKbAccount,
  type MaxKbRecord,
} from '../../api/knowledgeOpenApi'
import { getScenicStructuredRecords, type ScenicStructuredRecord } from '../../api/scenicStructured'
import {
  createVoiceScriptRecord,
  deleteVoiceScriptRecord,
  generateVoiceScript,
  getVoiceScriptRecords,
  publishVoiceScriptRecord,
  rollbackVoiceScriptRecord,
  synthesizeVoiceScriptRecord,
  updateVoiceScriptRecord,
  type VoiceScriptGeneratePayload,
  type VoiceScriptScene,
  type VoiceScriptScenePayload,
  type VoiceScriptSynthesizePayload,
} from '../../api/voiceScripts'

type Row = VoiceScriptScene & { key: string }
type SelectOption = { value: string; label: string }
type DurationPreset = 30 | 60 | 90 | 120 | 'custom'

type GenerateFormValues = {
  spotId: string
  accountId: number
  knowledgeIds: string[]
  documentIdsByKnowledge?: Record<string, string[]>
  style: VoiceScriptScene['style']
  durationPreset: DurationPreset
  customDurationSec?: number
  additionalRequirements?: string
}

type EditorFormValues = VoiceScriptScenePayload
  & VoiceScriptSynthesizePayload
  & Pick<VoiceScriptScene, 'generationMode' | 'sourceRefsJson'>

const sceneTypeOptions = [
  { value: 'overview', label: '总览长播' },
  { value: 'spot', label: '景点长播' },
  { value: 'transition', label: '转场短播' },
]

const styleOptions = [
  { value: 'culture', label: '文化讲解' },
  { value: 'family', label: '亲子互动' },
  { value: 'light', label: '轻松导览' },
]

const durationOptions: Array<{ value: DurationPreset; label: string }> = [
  { value: 30, label: '30秒' },
  { value: 60, label: '60秒' },
  { value: 90, label: '90秒' },
  { value: 120, label: '120秒' },
  { value: 'custom', label: '自定义' },
]

const voiceOptions = [
  { value: 'zh-CN-XiaoxiaoNeural', label: '晓晓（自然亲和）' },
  { value: 'zh-CN-YunxiNeural', label: '云希（成熟稳重）' },
  { value: 'zh-CN-XiaoyiNeural', label: '晓伊（温柔清晰）' },
  { value: 'zh-CN-YunjianNeural', label: '云健（沉稳有力）' },
]

const speechRateOptions = [
  { value: '-20%', label: '慢速（-20%）' },
  { value: '+0%', label: '标准（+0%）' },
  { value: '+20%', label: '快速（+20%）' },
]

const speechVolumeOptions = [
  { value: '-20%', label: '较轻（-20%）' },
  { value: '+0%', label: '标准（+0%）' },
  { value: '+20%', label: '较响（+20%）' },
]

const speechPitchOptions = [
  { value: '-10Hz', label: '偏低（-10Hz）' },
  { value: '+0Hz', label: '标准（+0Hz）' },
  { value: '+10Hz', label: '偏高（+10Hz）' },
]

function voiceScriptErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data
    if (data && typeof data === 'object') {
      const record = data as { message?: unknown; error?: unknown; detail?: unknown }
      for (const candidate of [record.message, record.detail, record.error]) {
        if (typeof candidate === 'string' && candidate.trim()) return candidate
      }
    }
    if (typeof data === 'string' && data.trim()) return data
    if (error.code === 'ERR_NETWORK') return '无法连接后端服务，请确认 backend-java 已启动'
    return error.message || fallback
  }
  if (error instanceof Error && error.message) return error.message
  return fallback
}

function isFormValidationError(error: unknown): error is { errorFields?: Array<{ name?: Array<string | number> }> } {
  return typeof error === 'object' && error !== null && 'errorFields' in error
}

function recordText(record: MaxKbRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value
    if (typeof value === 'number') return String(value)
  }
  return ''
}

function recordOption(record: MaxKbRecord, kind: 'knowledge' | 'document'): SelectOption | null {
  const value = recordText(record, ['id', `${kind}_id`, 'uuid'])
  if (!value) return null
  const label = recordText(record, ['name', 'title', `${kind}_name`]) || value
  return { value, label }
}

function canPublishVoiceScript(record: VoiceScriptScene) {
  return record.status !== 'published' && record.audioStatus === 'ready' && Boolean(record.audioUrl)
}

function audioStatusTag(record: VoiceScriptScene) {
  if (record.audioStatus === 'ready') return <Tag color="green">音频可用</Tag>
  if (record.audioStatus === 'stale') return <Tag color="orange">音频已过期</Tag>
  if (record.audioStatus === 'failed') return <Tag color="red">合成失败</Tag>
  return <Tag>未合成</Tag>
}

function sourceLabel(record: VoiceScriptScene) {
  if (record.generationMode === 'ai' || record.generationMode === 'knowledge') return 'AI知识库'
  if (record.generationMode === 'manual' || record.sourceFile === '手工新增') return '手工新增'
  if (record.generationMode === 'docx') return 'DOCX历史导入'
  return record.sourceFile || '未知来源'
}

function sourceDetail(record: VoiceScriptScene) {
  if (!record.sourceRefsJson) return sourceLabel(record)
  try {
    const snapshot = JSON.parse(record.sourceRefsJson) as {
      knowledgeSources?: Array<{
        knowledgeId?: string
        knowledgeName?: string
        selectedDocumentIds?: string[]
        hits?: unknown[]
      }>
    }
    const sources = snapshot.knowledgeSources ?? []
    if (!sources.length) return '景点结构化数据'
    return sources.map((source) => {
      const name = source.knowledgeName || source.knowledgeId || '未命名知识库'
      const documents = source.selectedDocumentIds?.length
        ? `${source.selectedDocumentIds.length}个指定文档`
        : '全部文档'
      return `${name}（${documents}，命中${source.hits?.length ?? 0}条）`
    }).join('；')
  } catch {
    return record.sourceRefsJson
  }
}

function toEditorValues(record: VoiceScriptScene): EditorFormValues {
  return {
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
    generationMode: record.generationMode,
    sourceFile: record.sourceFile,
    sourceRefsJson: record.sourceRefsJson,
    voiceId: record.voiceId || 'zh-CN-XiaoxiaoNeural',
    speechRate: record.speechRate || '+0%',
    speechVolume: record.speechVolume || '+0%',
    speechPitch: record.speechPitch || '+0Hz',
  }
}

function toScenePayload(values: EditorFormValues): VoiceScriptScenePayload {
  return {
    scenicName: values.scenicName,
    spotId: values.spotId,
    spotName: values.spotName,
    sceneType: values.sceneType,
    style: values.style,
    title: values.title,
    scriptText: values.scriptText,
    ssmlText: values.ssmlText,
    durationSec: values.durationSec,
    versionNo: values.versionNo,
    status: values.status,
    sourceFile: values.sourceFile,
  }
}

export default function VoiceScriptPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [synthesizing, setSynthesizing] = useState(false)
  const [generateOpen, setGenerateOpen] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<Row | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [spots, setSpots] = useState<ScenicStructuredRecord[]>([])
  const [accounts, setAccounts] = useState<MaxKbAccount[]>([])
  const [knowledgeOptions, setKnowledgeOptions] = useState<SelectOption[]>([])
  const [documentsByKnowledge, setDocumentsByKnowledge] = useState<Record<string, SelectOption[]>>({})
  const [loadingKnowledges, setLoadingKnowledges] = useState(false)
  const [loadingDocuments, setLoadingDocuments] = useState(false)
  const [generateForm] = Form.useForm<GenerateFormValues>()
  const [editorForm] = Form.useForm<EditorFormValues>()
  const durationPreset = Form.useWatch('durationPreset', generateForm)
  const selectedKnowledgeIds = Form.useWatch('knowledgeIds', generateForm) ?? []
  const currentScriptText = Form.useWatch('scriptText', editorForm)

  const loadRows = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getVoiceScriptRecords()
      setRows(data.map((item) => ({ ...item, key: String(item.id) })))
    } catch (error) {
      message.error(`加载口播数据失败：${voiceScriptErrorMessage(error, '请检查后端服务')}`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial backend fetch owns the loading state
    void loadRows()
    Promise.all([getScenicStructuredRecords(), getKnowledgeAccounts({ current: 1, size: 200, status: 1 })])
      .then(([spotRecords, accountPage]) => {
        setSpots(spotRecords)
        setAccounts(accountPage.records ?? [])
      })
      .catch((error) => message.error(`加载生成基础数据失败：${voiceScriptErrorMessage(error, '请稍后重试')}`))
  }, [loadRows])

  const spotOptions = useMemo(
    () => spots.map((spot) => ({ value: spot.spot_id, label: `${spot.spot_name}（${spot.spot_id}）` })),
    [spots],
  )

  const loadKnowledges = async (accountId: number) => {
    generateForm.setFieldsValue({ knowledgeIds: [], documentIdsByKnowledge: {} })
    setKnowledgeOptions([])
    setDocumentsByKnowledge({})
    setLoadingKnowledges(true)
    try {
      const payload = await getKnowledges(accountId, { page: 1, size: 200 })
      setKnowledgeOptions(extractRecords(payload).map((item) => recordOption(item, 'knowledge')).filter((item): item is SelectOption => Boolean(item)))
    } catch (error) {
      message.error(`加载知识库失败：${voiceScriptErrorMessage(error, '请稍后重试')}`)
    } finally {
      setLoadingKnowledges(false)
    }
  }

  const loadDocumentsForKnowledge = useCallback(async (accountId: number, knowledgeId: string) => {
    const payload = await getKnowledgeDocuments(accountId, knowledgeId, { page: 1, size: 200 })
    return extractRecords(payload)
      .map((item) => recordOption(item, 'document'))
      .filter((item): item is SelectOption => Boolean(item))
      .map((item) => ({ ...item, label: `${item.label} · ${knowledgeOptions.find((it) => it.value === knowledgeId)?.label ?? knowledgeId}` }))
  }, [knowledgeOptions])

  const handleKnowledgeSelection = async (knowledgeIds: string[]) => {
    const accountId = generateForm.getFieldValue('accountId')
    if (!accountId) return
    const retained = Object.fromEntries(Object.entries(documentsByKnowledge).filter(([id]) => knowledgeIds.includes(id)))
    const missing = knowledgeIds.filter((id) => !retained[id])
    setDocumentsByKnowledge(retained)
    const currentSelections = generateForm.getFieldValue('documentIdsByKnowledge') ?? {}
    generateForm.setFieldValue(
      'documentIdsByKnowledge',
      Object.fromEntries(Object.entries(currentSelections).filter(([id]) => knowledgeIds.includes(id))),
    )
    if (!missing.length) return
    setLoadingDocuments(true)
    try {
      const loaded = await Promise.all(missing.map(async (id) => [id, await loadDocumentsForKnowledge(accountId, id)] as const))
      setDocumentsByKnowledge((current) => ({ ...current, ...Object.fromEntries(loaded) }))
    } catch (error) {
      message.error(`加载知识库文档失败：${voiceScriptErrorMessage(error, '请稍后重试')}`)
    } finally {
      setLoadingDocuments(false)
    }
  }

  const openEditor = (record: VoiceScriptScene) => {
    const row = { ...record, key: String(record.id) }
    setEditing(row)
    editorForm.resetFields()
    editorForm.setFieldsValue(toEditorValues(record))
    setEditorOpen(true)
  }

  const openManualEditor = () => {
    setEditing(null)
    editorForm.resetFields()
    editorForm.setFieldsValue({
      scenicName: '',
      spotId: '',
      spotName: '',
      sceneType: 'spot',
      style: 'culture',
      title: '',
      scriptText: '',
      ssmlText: '',
      durationSec: 60,
      versionNo: 1,
      status: 'draft',
      generationMode: 'manual',
      sourceFile: '手工新增',
      voiceId: 'zh-CN-XiaoxiaoNeural',
      speechRate: '+0%',
      speechVolume: '+0%',
      speechPitch: '+0Hz',
    })
    setEditorOpen(true)
  }

  const handleGenerate = async () => {
    try {
      const values = await generateForm.validateFields()
      const targetDurationSec = values.durationPreset === 'custom'
        ? Number(values.customDurationSec)
        : values.durationPreset
      const payload: VoiceScriptGeneratePayload = {
        accountId: values.accountId,
        spotId: values.spotId,
        style: values.style,
        targetDurationSec,
        additionalRequirements: values.additionalRequirements?.trim() || undefined,
        knowledgeSources: values.knowledgeIds.map((knowledgeId) => ({
          knowledgeId,
          knowledgeName: knowledgeOptions.find((item) => item.value === knowledgeId)?.label ?? knowledgeId,
          documentIds: values.documentIdsByKnowledge?.[knowledgeId] ?? [],
        })),
      }
      setGenerating(true)
      const generated = await generateVoiceScript(payload)
      message.success('AI口播草稿已生成，请审核并合成语音')
      setGenerateOpen(false)
      generateForm.resetFields()
      await loadRows()
      openEditor(generated)
    } catch (error) {
      if (isFormValidationError(error)) return
      message.error(`生成失败：${voiceScriptErrorMessage(error, '请检查知识库资料和生成参数')}`)
    } finally {
      setGenerating(false)
    }
  }

  const handleSave = async () => {
    try {
      const values = await editorForm.validateFields()
      setSaving(true)
      const saved = editing
        ? await updateVoiceScriptRecord(editing.id, toScenePayload(values))
        : await createVoiceScriptRecord(toScenePayload(values))
      message.success(editing ? '口播草稿已更新' : '手工口播已新增')
      await loadRows()
      openEditor(saved)
    } catch (error) {
      if (isFormValidationError(error)) {
        const firstFieldName = error.errorFields?.[0]?.name
        if (firstFieldName) editorForm.scrollToField(firstFieldName)
        return
      }
      message.error(`保存失败：${voiceScriptErrorMessage(error, '请检查字段填写')}`)
    } finally {
      setSaving(false)
    }
  }

  const handleSynthesize = async () => {
    if (!editing) {
      message.warning('请先保存口播文字，再合成试听')
      return
    }
    try {
      const values = await editorForm.validateFields()
      setSynthesizing(true)
      await updateVoiceScriptRecord(editing.id, toScenePayload(values))
      const synthesized = await synthesizeVoiceScriptRecord(editing.id, {
        voiceId: values.voiceId,
        speechRate: values.speechRate,
        speechVolume: values.speechVolume,
        speechPitch: values.speechPitch,
      })
      message.success('语音合成完成，可以试听')
      await loadRows()
      openEditor(synthesized)
    } catch (error) {
      if (isFormValidationError(error)) return
      message.error(`合成失败：${voiceScriptErrorMessage(error, '请检查语音服务配置')}`)
    } finally {
      setSynthesizing(false)
    }
  }

  const handleRollback = async (record: VoiceScriptScene) => {
    try {
      const rolledBack = await rollbackVoiceScriptRecord(record.id)
      message.success(`已基于版本 ${record.versionNo} 创建新草稿`)
      await loadRows()
      openEditor(rolledBack)
    } catch (error) {
      message.error(`回滚失败：${voiceScriptErrorMessage(error, '请稍后重试')}`)
    }
  }

  const handlePublish = async (record: VoiceScriptScene) => {
    if (!canPublishVoiceScript(record)) {
      message.warning('发布前必须先合成与当前文本一致的音频')
      return
    }
    try {
      const published = await publishVoiceScriptRecord(record.id)
      message.success('口播与语音已发布')
      await loadRows()
      if (editing?.id === record.id) openEditor(published)
    } catch (error) {
      message.error(`发布失败：${voiceScriptErrorMessage(error, '请稍后重试')}`)
    }
  }

  const columns: TableColumnsType<Row> = [
    { title: '景区', dataIndex: 'scenicName', width: 130 },
    { title: '景点', dataIndex: 'spotName', width: 170 },
    { title: '标题', dataIndex: 'title', width: 220, ellipsis: true },
    {
      title: '风格', dataIndex: 'style', width: 100,
      render: (value: string) => styleOptions.find((item) => item.value === value)?.label ?? value,
    },
    { title: '时长', dataIndex: 'durationSec', width: 85, render: (value: number) => `${value}秒` },
    { title: '版本', dataIndex: 'versionNo', width: 75, render: (value: number) => `V${value}` },
    {
      title: '来源', key: 'source', width: 120,
      render: (_, record) => <Tooltip title={sourceDetail(record)}><Tag color={record.generationMode === 'ai' || record.generationMode === 'knowledge' ? 'blue' : undefined}>{sourceLabel(record)}</Tag></Tooltip>,
    },
    {
      title: '音频状态', key: 'audioStatus', width: 120,
      render: (_, record) => audioStatusTag(record),
    },
    {
      title: '发布状态', dataIndex: 'status', width: 100,
      render: (value: string) => value === 'published' ? <Tag color="green">已发布</Tag> : value === 'archived' ? <Tag>已归档</Tag> : <Tag color="orange">草稿</Tag>,
    },
    {
      title: '操作', key: 'actions', width: 330, fixed: 'right',
      render: (_, record) => {
        const publishable = canPublishVoiceScript(record)
        return (
          <Space size={2}>
            <Button type="link" icon={<EditOutlined />} onClick={() => openEditor(record)}>编辑</Button>
            <Popconfirm title="将以该版本内容创建一个新的草稿版本，是否继续？" onConfirm={() => void handleRollback(record)}>
              <Button type="link" icon={<HistoryOutlined />}>回滚为新草稿</Button>
            </Popconfirm>
            <Tooltip title={publishable ? undefined : '发布前必须先合成与当前文本一致的音频'}>
              <span><Button type="link" disabled={!publishable} onClick={() => void handlePublish(record)}>发布</Button></span>
            </Tooltip>
            <Popconfirm title="确认删除该条口播吗？" onConfirm={async () => {
              try {
                await deleteVoiceScriptRecord(record.id)
                message.success('删除成功')
                await loadRows()
              } catch (error) {
                message.error(`删除失败：${voiceScriptErrorMessage(error, '请稍后重试')}`)
              }
            }}>
              <Button type="link" danger icon={<DeleteOutlined />}>删除</Button>
            </Popconfirm>
          </Space>
        )
      },
    },
  ]

  const editorPublishReady = Boolean(
    editing && canPublishVoiceScript(editing) && currentScriptText === editing.scriptText,
  )
  const immutableVersion = Boolean(editing && editing.status !== 'draft')

  return (
    <div className="admin-panel-grid travel-analytics-page">
      <Card
        title="景点口播生产工作台"
        className="travel-analytics-card"
        extra={
          <Space>
            <Button type="primary" icon={<RobotOutlined />} onClick={() => {
              generateForm.resetFields()
              generateForm.setFieldsValue({ style: 'culture', durationPreset: 60, knowledgeIds: [], documentIdsByKnowledge: {} })
              setKnowledgeOptions([])
              setDocumentsByKnowledge({})
              setGenerateOpen(true)
            }}>AI生成口播</Button>
            <Button icon={<PlusOutlined />} onClick={openManualEditor}>手工新增</Button>
            <Button icon={<ReloadOutlined />} onClick={() => void loadRows()} loading={loading}>刷新</Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={rows}
          loading={loading}
          tableLayout="fixed"
          scroll={{ x: 1550, y: 'calc(100vh - 280px)' }}
          pagination={{ pageSize: 20, showSizeChanger: true, pageSizeOptions: ['10', '20', '50'], position: ['bottomLeft'] }}
        />
      </Card>

      <Drawer
        title="AI生成口播"
        width={680}
        open={generateOpen}
        onClose={() => setGenerateOpen(false)}
        destroyOnClose
        extra={<Space><Button onClick={() => setGenerateOpen(false)}>取消</Button><Button type="primary" icon={<RobotOutlined />} loading={generating} onClick={() => void handleGenerate()}>生成草稿</Button></Space>}
      >
        <Alert type="info" showIcon message="景点结构化数据会自动加入生成上下文；知识库与文档可以多选。生成结果仅保存为草稿。" />
        <Form form={generateForm} layout="vertical" style={{ marginTop: 20 }}>
          <Form.Item name="spotId" label="选择景点" rules={[{ required: true, message: '请选择景点' }]}>
            <Select showSearch optionFilterProp="label" options={spotOptions} placeholder="选择一个景点" />
          </Form.Item>
          <Form.Item name="accountId" label="选择知识库账号" rules={[{ required: true, message: '请选择知识库账号' }]}>
            <Select
              options={accounts.map((account) => ({ value: account.id, label: account.accountName }))}
              placeholder="选择 MaxKB 账号"
              onChange={(value) => void loadKnowledges(value)}
            />
          </Form.Item>
          <Form.Item name="knowledgeIds" label="选择知识库" rules={[{ required: true, type: 'array', min: 1, message: '至少选择一个知识库' }]}>
            <Select mode="multiple" options={knowledgeOptions} loading={loadingKnowledges} placeholder="可选择多个知识库" onChange={(value) => void handleKnowledgeSelection(value)} />
          </Form.Item>
          {selectedKnowledgeIds.map((knowledgeId) => (
            <Form.Item
              key={knowledgeId}
              name={['documentIdsByKnowledge', knowledgeId]}
              label={`选择文档（可选）· ${knowledgeOptions.find((item) => item.value === knowledgeId)?.label ?? knowledgeId}`}
              tooltip="不选择时，将检索该知识库中的全部文档"
            >
              <Select
                mode="multiple"
                options={documentsByKnowledge[knowledgeId] ?? []}
                loading={loadingDocuments}
                allowClear
                placeholder="不选则使用该知识库内全部文档"
              />
            </Form.Item>
          ))}
          <Form.Item name="style" label="口播风格" rules={[{ required: true, message: '请选择口播风格' }]}>
            <Select options={styleOptions} />
          </Form.Item>
          <Form.Item name="durationPreset" label="目标讲解时长" rules={[{ required: true, message: '请选择时长' }]}>
            <Segmented block options={durationOptions} />
          </Form.Item>
          {durationPreset === 'custom' && (
            <Form.Item name="customDurationSec" label="自定义时长（秒）" rules={[{ required: true, message: '请输入自定义时长' }]}>
              <InputNumber min={20} max={300} style={{ width: '100%' }} />
            </Form.Item>
          )}
          <Form.Item name="additionalRequirements" label="补充要求">
            <Input.TextArea rows={4} maxLength={500} showCount placeholder="例如：重点讲建筑工艺，避免宗教术语堆砌，结尾提示最佳拍照位置" />
          </Form.Item>
        </Form>
      </Drawer>

      <Drawer
        title={editing ? `编辑口播 · V${editing.versionNo}` : '手工新增口播'}
        width={820}
        open={editorOpen}
        onClose={() => { setEditorOpen(false); setEditing(null); editorForm.resetFields() }}
        destroyOnClose
        extra={
          <Space>
            <Button onClick={() => setEditorOpen(false)}>关闭</Button>
            {editing && (
              <Popconfirm title="将以当前版本内容创建一个新的草稿版本，是否继续？" onConfirm={() => void handleRollback(editing)}>
                <Button icon={<HistoryOutlined />}>回滚为新草稿</Button>
              </Popconfirm>
            )}
            <Button loading={saving} disabled={immutableVersion} onClick={() => void handleSave()}>保存草稿</Button>
            <Button type="primary" disabled={!editorPublishReady} onClick={() => editing && void handlePublish(editing)}>发布</Button>
          </Space>
        }
      >
        {editing && (
          <Descriptions size="small" column={3} bordered>
            <Descriptions.Item label="版本">V{editing.versionNo}</Descriptions.Item>
            <Descriptions.Item label="来源">{sourceLabel(editing)}</Descriptions.Item>
            <Descriptions.Item label="音频">{audioStatusTag(editing)}</Descriptions.Item>
          </Descriptions>
        )}
        {immutableVersion && (
          <Alert
            type="info"
            showIcon
            message="已发布或已归档版本为只读；需要修改时请回滚为新草稿"
            style={{ marginTop: 16 }}
          />
        )}
        <Form
          form={editorForm}
          layout="vertical"
          disabled={immutableVersion}
          scrollToFirstError
          style={{ marginTop: editing ? 20 : 0 }}
          onValuesChange={(changed) => {
            if ('spotId' in changed) {
              const spot = spots.find((item) => item.spot_id === changed.spotId)
              if (spot) editorForm.setFieldsValue({ scenicName: spot.scenic_name, spotName: spot.spot_name })
            }
          }}
        >
          <Form.Item name="spotId" label="景点" rules={[{ required: true, message: '请选择景点' }]}>
            <Select showSearch optionFilterProp="label" options={spotOptions} disabled={Boolean(editing)} />
          </Form.Item>
          <Form.Item name="scenicName" hidden><Input /></Form.Item>
          <Form.Item name="spotName" hidden><Input /></Form.Item>
          <Space size={16} style={{ display: 'flex' }} align="start">
            <Form.Item name="sceneType" label="场景" rules={[{ required: true }]} style={{ width: 180 }}><Select options={sceneTypeOptions} /></Form.Item>
            <Form.Item name="style" label="风格" rules={[{ required: true }]} style={{ width: 180 }}><Select options={styleOptions} /></Form.Item>
            <Form.Item name="durationSec" label="预计时长（秒）" rules={[{ required: true }]} style={{ width: 180 }}><InputNumber min={20} max={300} style={{ width: '100%' }} /></Form.Item>
          </Space>
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}><Input maxLength={100} /></Form.Item>
          <Form.Item name="scriptText" label="口播内容" rules={[{ required: true, message: '请输入口播内容' }, { max: 1200, message: '口播内容不能超过1200字' }]}>
            <Input.TextArea rows={11} showCount maxLength={1200} placeholder="可以完全手工编写，也可以在 AI 草稿基础上修改" />
          </Form.Item>
          <Form.Item name="ssmlText" label="SSML（可选）"><Input.TextArea rows={4} /></Form.Item>
          <Form.Item name="versionNo" hidden><InputNumber /></Form.Item>
          <Form.Item name="status" hidden><Input /></Form.Item>
          <Form.Item name="generationMode" hidden><Input /></Form.Item>
          <Form.Item name="sourceFile" hidden><Input /></Form.Item>
          <Form.Item name="sourceRefsJson" hidden><Input /></Form.Item>

          <Divider titlePlacement="start">语音合成与试听</Divider>
          {editing && currentScriptText !== editing.scriptText && (
            <Alert type="warning" showIcon message="口播文字已修改，原音频将失效；请保存并重新合成后再发布。" style={{ marginBottom: 16 }} />
          )}
          <Form.Item name="voiceId" label="音色" rules={[{ required: true, message: '请选择音色' }]}><Select options={voiceOptions} /></Form.Item>
          <Form.Item name="speechRate" label="语速"><Select options={speechRateOptions} /></Form.Item>
          <Form.Item name="speechVolume" label="音量"><Select options={speechVolumeOptions} /></Form.Item>
          <Form.Item name="speechPitch" label="语调"><Select options={speechPitchOptions} /></Form.Item>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Button icon={<AudioOutlined />} loading={synthesizing} disabled={!editing || immutableVersion} onClick={() => void handleSynthesize()}>合成试听</Button>
            {editing?.audioUrl && <audio controls src={editing.audioUrl} style={{ width: '100%' }} />}
            {!editorPublishReady && <Alert type="info" showIcon message="发布前必须先合成与当前文本一致的音频" />}
          </Space>
        </Form>
      </Drawer>
    </div>
  )
}
