import { useEffect, useMemo, useState } from 'react'
import { Button, Card, Descriptions, Drawer, Form, Input, Select, Space, Table, Tag, message } from 'antd'
import type { TableColumnsType } from 'antd'
import { getFeedback, updateFeedback, type FeedbackRecord } from '../api/operations'

const statuses = [{ value: 'PENDING', label: '待处理' }, { value: 'PROCESSING', label: '处理中' }, { value: 'RESOLVED', label: '已解决' }]
const categories = [{ value: 'GENERAL', label: '一般' }, { value: 'CONTEXTUAL', label: '上下文' }, { value: 'CONTENT', label: '内容' }, { value: 'ROUTE', label: '路线' }, { value: 'SERVICE', label: '服务' }]

export default function FeedbackManagementPage() {
  const [records, setRecords] = useState<FeedbackRecord[]>([])
  const [selected, setSelected] = useState<FeedbackRecord>()
  const [status, setStatus] = useState<string>()
  const [category, setCategory] = useState<string>()
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()
  const load = () => getFeedback().then(setRecords).catch(() => message.error('反馈加载失败'))
  useEffect(() => { void load() }, [])
  const filtered = useMemo(() => records.filter((item) => (!status || item.status === status) && (!category || item.category === category)), [records, status, category])
  const open = (record: FeedbackRecord) => { setSelected(record); form.setFieldsValue(record) }
  const save = async () => {
    if (!selected) return
    const values = await form.validateFields()
    setSaving(true)
    try { await updateFeedback(selected.id, values); message.success('反馈已更新'); setSelected(undefined); await load() }
    catch { message.error('反馈更新失败') } finally { setSaving(false) }
  }
  const columns: TableColumnsType<FeedbackRecord> = [
    { title: '问题', dataIndex: 'question', ellipsis: true },
    { title: '评分', dataIndex: 'rating', width: 72 },
    { title: '状态', dataIndex: 'status', width: 100, render: (value) => <Tag>{statuses.find((item) => item.value === value)?.label}</Tag> },
    { title: '分类', dataIndex: 'category', width: 100, responsive: ['md'] },
    { title: '提交时间', dataIndex: 'createdAt', width: 180, responsive: ['lg'] },
    { title: '操作', width: 86, render: (_, record) => <Button type="link" onClick={() => open(record)}>详情</Button> },
  ]
  return <Card title="游客反馈管理" extra={<Space wrap><Select allowClear placeholder="状态" options={statuses} onChange={setStatus} /><Select allowClear placeholder="分类" options={categories} onChange={setCategory} /></Space>}>
    <Table rowKey="id" columns={columns} dataSource={filtered} scroll={{ x: 620 }} />
    <Drawer title="反馈详情与处理" width={520} open={Boolean(selected)} onClose={() => setSelected(undefined)} extra={<Button type="primary" loading={saving} onClick={() => void save()}>保存</Button>}>
      {selected && <><Descriptions column={1} bordered size="small" items={[{ key: 'question', label: '问题', children: selected.question }, { key: 'answer', label: '回答', children: selected.answer || '-' }, { key: 'comment', label: '游客意见', children: selected.comment || '-' }, { key: 'trace', label: 'Trace', children: selected.traceId || '-' }]} />
      <Form form={form} layout="vertical" className="feedback-form"><Form.Item name="status" label="处理状态" rules={[{ required: true }]}><Select options={statuses} /></Form.Item><Form.Item name="category" label="反馈分类" rules={[{ required: true }]}><Select options={categories} /></Form.Item><Form.Item name="adminNote" label="管理员备注"><Input.TextArea rows={5} maxLength={1000} showCount /></Form.Item></Form></>}
    </Drawer>
  </Card>
}
