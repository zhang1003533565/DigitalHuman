import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Button,
  Descriptions,
  Drawer,
  Empty,
  Input,
  Popconfirm,
  Select,
  Space,
  Tag,
  Typography,
  message,
} from 'antd'
import axios from 'axios'
import {
  extractRecords,
  getKnowledges,
  listKnowledgeAccounts,
  type MaxKbAccount,
} from '../../api/knowledgeOpenApi'
import {
  getScenicKnowledgePublicationStatus,
  previewScenicKnowledgePublication,
  publishScenicKnowledge,
  withdrawScenicKnowledge,
  type ScenicKnowledgePreview,
  type ScenicKnowledgePublication,
  type ScenicKnowledgePublicationStatus,
  type ScenicStructuredRecord,
} from '../../api/scenicStructured'
import type { ScenicFacility } from '../../api/scenic'
import {
  canPublishScenicKnowledge,
  classifyPublicationStatusLoadFailure,
  isCurrentScenicKnowledgePreview,
  nextScenicKnowledgeRequestGeneration,
  shouldApplyScenicKnowledgeResponse,
  shouldLoadScenicKnowledgeTargets,
} from './scenicKnowledgePublishState'

type ScenicKnowledgePublishDrawerProps = {
  open: boolean
  role: 'ADMIN' | 'OBSERVER'
  record: ScenicStructuredRecord | null
  facility: ScenicFacility | null
  onClose: () => void
  onUpdated: () => Promise<void> | void
}

type KnowledgeOption = {
  value: string
  label: string
}

const STATUS_META: Record<ScenicKnowledgePublicationStatus, { color: string; text: string }> = {
  publishing: { color: 'processing', text: '发布中' },
  published: { color: 'success', text: '已发布' },
  outdated: { color: 'warning', text: '待重发' },
  failed: { color: 'error', text: '发布失败' },
  withdrawn: { color: 'default', text: '已撤回' },
}

function safeErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data
    if (typeof detail === 'string' && detail.trim()) return detail.trim()
    if (detail && typeof detail === 'object') {
      for (const key of ['message', 'msg', 'error', 'detail']) {
        const value = (detail as Record<string, unknown>)[key]
        if (typeof value === 'string' && value.trim()) return value.trim()
      }
    }
  }
  if (error instanceof Error && error.message.trim()) return error.message.trim()
  return fallback
}

function knowledgeOptionOf(item: Record<string, unknown>): KnowledgeOption | null {
  const value = [item.id, item.knowledge_id, item.knowledgeId, item.uuid]
    .find((candidate) => typeof candidate === 'string' && candidate.trim()) as string | undefined
  if (!value) return null
  const label = [item.name, item.knowledge_name, item.knowledgeName, item.title]
    .find((candidate) => typeof candidate === 'string' && candidate.trim()) as string | undefined
  return { value, label: label ?? value }
}

export default function ScenicKnowledgePublishDrawer({
  open,
  role,
  record,
  facility,
  onClose,
  onUpdated,
}: ScenicKnowledgePublishDrawerProps) {
  const isObserver = role === 'OBSERVER'
  const [preview, setPreview] = useState<ScenicKnowledgePreview | null>(null)
  const [publication, setPublication] = useState<ScenicKnowledgePublication | null>(null)
  const [accounts, setAccounts] = useState<MaxKbAccount[]>([])
  const [accountId, setAccountId] = useState<number | undefined>()
  const [knowledgeId, setKnowledgeId] = useState<string>()
  const [knowledgeName, setKnowledgeName] = useState<string>()
  const [knowledgeOptions, setKnowledgeOptions] = useState<KnowledgeOption[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingKnowledges, setLoadingKnowledges] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [withdrawing, setWithdrawing] = useState(false)
  const loadGenerationRef = useRef(0)
  const knowledgeGenerationRef = useRef(0)

  const currentStatus = publication?.status
  const currentStatusMeta = currentStatus ? STATUS_META[currentStatus] : null
  const previewMatchesCurrent = isCurrentScenicKnowledgePreview(preview, record?.id, facility?.id)

  const loadKnowledges = useCallback(async (nextAccountId: number, preferredKnowledgeId?: string) => {
    const generation = nextScenicKnowledgeRequestGeneration(knowledgeGenerationRef.current)
    knowledgeGenerationRef.current = generation
    setLoadingKnowledges(true)
    try {
      const payload = await getKnowledges(nextAccountId, { page: 1, size: 200 })
      if (!shouldApplyScenicKnowledgeResponse(knowledgeGenerationRef.current, generation)) return
      const options = extractRecords(payload)
        .map((item) => knowledgeOptionOf(item))
        .filter((item): item is KnowledgeOption => Boolean(item))
      setKnowledgeOptions(options)
      const matched = options.find((item) => item.value === preferredKnowledgeId)
      if (matched) {
        setKnowledgeId(matched.value)
        setKnowledgeName(matched.label)
      } else {
        setKnowledgeId(undefined)
        setKnowledgeName(undefined)
      }
    } catch (error) {
      if (!shouldApplyScenicKnowledgeResponse(knowledgeGenerationRef.current, generation)) return
      setKnowledgeOptions([])
      setKnowledgeId(undefined)
      setKnowledgeName(undefined)
      message.error(`加载知识库失败：${safeErrorMessage(error, '请稍后重试')}`)
    } finally {
      if (shouldApplyScenicKnowledgeResponse(knowledgeGenerationRef.current, generation)) {
        setLoadingKnowledges(false)
      }
    }
  }, [])

  const loadDrawer = useCallback(async () => {
    if (!open || !record || !facility) return
    const generation = nextScenicKnowledgeRequestGeneration(loadGenerationRef.current)
    loadGenerationRef.current = generation
    setLoading(true)
    try {
      const loadTargets = shouldLoadScenicKnowledgeTargets(role)
      const [nextPreview, accountPage, nextPublication] = await Promise.all([
        previewScenicKnowledgePublication(record.id),
        loadTargets ? listKnowledgeAccounts({ current: 1, size: 100, status: 1 }) : Promise.resolve(null),
        getScenicKnowledgePublicationStatus(facility.id).catch((error) => {
          const failure = classifyPublicationStatusLoadFailure({
            status: axios.isAxiosError(error) ? error.response?.status : null,
            message: safeErrorMessage(error, '状态加载失败'),
          })
          if (failure.kind === 'unpublished') return null
          throw new Error(failure.message ?? '状态加载失败')
        }),
      ])
      if (!shouldApplyScenicKnowledgeResponse(loadGenerationRef.current, generation)) return
      setPreview(nextPreview)
      setPublication(nextPublication)
      if (!loadTargets) {
        setAccounts([])
        setAccountId(nextPublication?.accountId)
        setKnowledgeId(nextPublication?.knowledgeId ?? undefined)
        setKnowledgeName(nextPublication?.knowledgeName ?? undefined)
        setKnowledgeOptions(nextPublication ? [{ value: nextPublication.knowledgeId, label: nextPublication.knowledgeName }] : [])
        return
      }
      const rows = accountPage?.records ?? []
      setAccounts(rows)
      const preferredAccountId = nextPublication?.accountId ?? rows[0]?.id
      setAccountId(preferredAccountId)
      if (preferredAccountId) {
        await loadKnowledges(preferredAccountId, nextPublication?.knowledgeId ?? undefined)
      } else {
        setKnowledgeOptions([])
      }
    } catch (error) {
      if (!shouldApplyScenicKnowledgeResponse(loadGenerationRef.current, generation)) return
      message.error(`加载知识发布工作台失败：${safeErrorMessage(error, '请检查后端服务')}`)
    } finally {
      if (shouldApplyScenicKnowledgeResponse(loadGenerationRef.current, generation)) {
        setLoading(false)
      }
    }
  }, [facility, loadKnowledges, open, record, role])

  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => {
      void loadDrawer()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [facility?.id, loadDrawer, open, record?.id])

  const accountOptions = useMemo(() => accounts.map((item) => ({
    value: item.id,
    label: `${item.accountName} · ${item.environmentText ?? item.environment}`,
  })), [accounts])

  const canPublish = canPublishScenicKnowledge({
    role,
    publishing,
    recordId: record?.id,
    facilityId: facility?.id,
    preview,
    accountId,
    knowledgeId,
    knowledgeName,
  })
  const publishLabel = currentStatus === 'published' || currentStatus === 'outdated' || currentStatus === 'failed' ? '重新发布' : '发布到知识库'

  const handleAccountChange = async (value: number) => {
    setAccountId(value)
    setKnowledgeId(undefined)
    setKnowledgeName(undefined)
    setKnowledgeOptions([])
    await loadKnowledges(value)
  }

  const handlePublish = async () => {
    if (isObserver || publishing || !record || !facility || !accountId || !knowledgeId || !knowledgeName || !canPublish || !previewMatchesCurrent) return
    setPublishing(true)
    try {
      const nextPublication = await publishScenicKnowledge(record.id, { accountId, knowledgeId, knowledgeName })
      setPublication(nextPublication)
      message.success(currentStatus === 'published' ? '知识文档已重新发布' : '知识文档已发布')
      await onUpdated()
      await loadDrawer()
    } catch (error) {
      message.error(`发布知识失败：${safeErrorMessage(error, '请稍后重试')}`)
    } finally {
      setPublishing(false)
    }
  }

  const handleWithdraw = async () => {
    if (isObserver || withdrawing || !facility) return
    setWithdrawing(true)
    try {
      const nextPublication = await withdrawScenicKnowledge(facility.id)
      setPublication(nextPublication)
      message.success('知识文档已撤回')
      await onUpdated()
      await loadDrawer()
    } catch (error) {
      message.error(`撤回知识失败：${safeErrorMessage(error, '请稍后重试')}`)
    } finally {
      setWithdrawing(false)
    }
  }

  return (
    <Drawer
      title={record ? `发布到知识库 · ${record.spot_name}` : '发布到知识库'}
      open={open}
      size={860}
      onClose={onClose}
      extra={!isObserver ? (
        <Space>
          {publication?.documentId ? (
            <Popconfirm
              title="确认撤回当前知识文档吗？"
              description="撤回会删除当前正式发布到目标知识库的文档。"
              onConfirm={() => void handleWithdraw()}
              disabled={isObserver || withdrawing}
            >
              <Button disabled={isObserver || withdrawing} loading={withdrawing}>
                撤回知识
              </Button>
            </Popconfirm>
          ) : null}
          <Button
            type="primary"
            onClick={() => void handlePublish()}
            loading={publishing}
            disabled={isObserver || publishing || !canPublish}
          >
            {publishLabel}
          </Button>
        </Space>
      ) : null}
    >
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        <Alert
          type={isObserver ? 'warning' : 'info'}
          showIcon
          title={isObserver ? 'Observer 只读' : '管理员发布工作台'}
          description={isObserver
            ? 'Observer 可查看正式 Markdown 预览与发布状态，但不能执行发布、重试或撤回。'
            : '这里只能发布已应用到正式景点的资料，发布正文来自后端正式景点快照，不读取暂存导入文本。'}
        />

        <Descriptions bordered size="small" column={2}>
          <Descriptions.Item label="导入记录">{record?.spot_name ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="正式景点">{facility?.name ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="景点编码">{record?.spot_id ?? facility?.spotCode ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="发布状态">
            {currentStatusMeta ? <Tag color={currentStatusMeta.color}>{currentStatusMeta.text}</Tag> : <Tag>未发布</Tag>}
          </Descriptions.Item>
          <Descriptions.Item label="知识库账号">
            <Select
              style={{ width: '100%' }}
              placeholder="选择 MaxKB 账号"
              value={accountId}
              options={accountOptions}
              loading={loading}
              onChange={(value) => void handleAccountChange(value)}
              disabled={isObserver || loading || !accounts.length}
              optionFilterProp="label"
              showSearch
            />
          </Descriptions.Item>
          <Descriptions.Item label="目标知识库">
            <Select
              style={{ width: '100%' }}
              placeholder="选择知识库"
              value={knowledgeId}
              options={knowledgeOptions}
              loading={loadingKnowledges}
              onChange={(value) => {
                setKnowledgeId(value)
                const matched = knowledgeOptions.find((item) => item.value === value)
                setKnowledgeName(matched?.label)
              }}
              disabled={isObserver || !accountId || loadingKnowledges}
              optionFilterProp="label"
              showSearch
            />
          </Descriptions.Item>
          <Descriptions.Item label="文档 ID">{publication?.documentId ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="内容版本">{preview?.contentVersion ?? publication?.version ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="发布时间">{publication?.publishedAt ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="发布人">{publication?.publishedBy ?? '-'}</Descriptions.Item>
        </Descriptions>

        {publication?.lastError ? (
          <Alert type="error" showIcon title="最近一次发布失败" description={publication.lastError} />
        ) : null}

        <div>
          <Typography.Title level={5}>Markdown 预览</Typography.Title>
          {preview ? (
            <Space orientation="vertical" size={12} style={{ width: '100%' }}>
              <Descriptions bordered size="small" column={2}>
                <Descriptions.Item label="文件名">{preview.fileName}</Descriptions.Item>
                <Descriptions.Item label="内容摘要">{preview.sha256}</Descriptions.Item>
              </Descriptions>
              <Input.TextArea value={preview.markdown} autoSize={{ minRows: 16, maxRows: 24 }} readOnly />
            </Space>
          ) : (
            <Empty description="暂无正式景点 Markdown 预览" />
          )}
        </div>
      </Space>
    </Drawer>
  )
}
