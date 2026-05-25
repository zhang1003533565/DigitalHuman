import { useEffect, useState } from 'react'
import axios from 'axios'
import {
  Button,
  Card,
  Col,
  Divider,
  Drawer,
  Form,
  Input,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  message,
  InputNumber,
  Popconfirm,
} from 'antd'
import type { TableColumnsType } from 'antd'

type RouteNodeRow = {
  id?: string
  name: string
  type: string
  spotRefId?: string
  stay: string
  summary: string
  required: boolean
  coordinate?: Coordinate
}

type RouteFacilityRow = {
  id?: string
  name: string
  linkedFacilityId?: string
  category: string
  nearNode: string
  nearNodeId?: string
  distance: string
  coordinate?: Coordinate
}

type RouteRow = {
  key: string
  id?: string
  name: string
  suitableFor: string
  duration: string
  distance?: string
  intensity?: string
  bestTime?: string
  reason?: string
  sortOrder?: number
  enabled?: boolean
  tags?: string[]
  nodes?: RouteNodeRow[]
  facilities?: RouteFacilityRow[]
}

type Coordinate = {
  longitude?: number
  latitude?: number
}

const routeColumns: TableColumnsType<RouteRow> = [
  { title: '路线名称', dataIndex: 'name' },
  { title: '适合人群', dataIndex: 'suitableFor' },
  { title: '时长', dataIndex: 'duration' },
  { title: '距离', dataIndex: 'distance' },
  { title: '强度', dataIndex: 'intensity' },
  {
    title: '状态',
    dataIndex: 'enabled',
    render: (enabled?: boolean) => <Tag color={enabled === false ? 'default' : 'green'}>{enabled === false ? '停用' : '启用'}</Tag>,
  },
]

function mapRouteResponse(item: {
  id: string
  name: string
  suitableFor: string
  duration: string
  distance?: string
  intensity?: string
  bestTime?: string
  reason?: string
  tags?: string[]
  nodes?: RouteNodeRow[]
  facilities?: RouteFacilityRow[]
  sortOrder?: number
  enabled?: boolean
}): RouteRow {
  return {
    key: item.id,
    id: item.id,
    name: item.name,
    suitableFor: item.suitableFor,
    duration: item.duration,
    distance: item.distance,
    intensity: item.intensity,
    bestTime: item.bestTime,
    reason: item.reason,
    sortOrder: item.sortOrder,
    enabled: item.enabled,
    tags: item.tags ?? [],
    nodes: item.nodes ?? [],
    facilities: item.facilities ?? [],
  }
}

export default function RouteManagementPage() {
  const [data, setData] = useState<RouteRow[]>([])
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingRoute, setEditingRoute] = useState<RouteRow | null>(null)
  const [form] = Form.useForm<RouteRow>()

  async function loadRoutes() {
      const response = await axios.get('/api/admin/scenic/routes')
      setData(response.data.map(mapRouteResponse))
  }

  useEffect(() => {
    void loadRoutes()
  }, [])

  function openRouteEditor(route?: RouteRow) {
    const nextRoute = route ?? {
      key: `draft-${Date.now()}`,
      name: '',
      suitableFor: '历史文化',
      duration: '',
      distance: '',
      intensity: '轻松少走',
      bestTime: '',
      reason: '',
      sortOrder: data.length + 1,
      enabled: true,
      tags: [],
      nodes: [],
      facilities: [],
    }
    setEditingRoute(nextRoute)
    form.setFieldsValue(nextRoute)
    setDrawerOpen(true)
  }

  async function handleSaveRoute(values: RouteRow) {
    const isDraft = !editingRoute?.id || editingRoute.key.startsWith('draft-')
    const payload = {
      ...values,
      id: isDraft ? undefined : editingRoute?.id,
      tags: values.tags ?? [],
      nodes: values.nodes ?? [],
      facilities: values.facilities ?? [],
    }

    try {
      if (isDraft) {
        await axios.post('/api/admin/scenic/routes', payload)
      } else {
        await axios.put(`/api/admin/scenic/routes/${encodeURIComponent(editingRoute.id ?? editingRoute.key)}`, payload)
      }
      await loadRoutes()
      setDrawerOpen(false)
      setEditingRoute(null)
      message.success('路线配置已保存，游客端推荐路线将同步更新。')
    } catch (error) {
      const description = axios.isAxiosError(error)
        ? error.response?.data?.message ?? '路线保存失败，请检查后端服务。'
        : '路线保存失败，请稍后重试。'
      message.error(description)
    }
  }

  async function deleteRoute(route: RouteRow) {
    await axios.delete(`/api/admin/scenic/routes/${encodeURIComponent(route.id ?? route.key)}`)
    await loadRoutes()
    message.success('路线已删除')
  }

  const editableRouteColumns: TableColumnsType<RouteRow> = [
    ...routeColumns,
    {
      title: '节点',
      dataIndex: 'nodes',
      render: (nodes?: RouteNodeRow[]) => nodes?.length ?? 0,
    },
    {
      title: '标签',
      dataIndex: 'tags',
      render: (tags?: string[]) => tags?.slice(0, 3).map((tag) => <Tag key={tag}>{tag}</Tag>),
    },
    {
      title: '操作',
      render: (_, record) => (
        <Space>
          <Button type="link" onClick={() => openRouteEditor(record)}>
            编辑配置
          </Button>
          <Popconfirm title="确认删除这条路线？" onConfirm={() => void deleteRoute(record)}>
            <Button type="link" danger>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <>
      <Card
        title="路线管理"
        extra={<Button type="primary" onClick={() => openRouteEditor()}>创建路线</Button>}
      >
        <Table columns={editableRouteColumns} dataSource={data} pagination={false} />
      </Card>

      <Drawer
        title={editingRoute?.name ? `编辑路线：${editingRoute.name}` : '创建路线'}
        width={720}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        extra={
          <Space>
            <Button onClick={() => setDrawerOpen(false)}>取消</Button>
            <Button type="primary" onClick={() => form.submit()}>保存草稿</Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical" onFinish={handleSaveRoute}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="name" label="路线名称" rules={[{ required: true, message: '请输入路线名称' }]}>
                <Input placeholder="例如：亲子家庭路线" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="suitableFor" label="路线主题">
                <Select
                  options={[
                    { value: '历史文化', label: '历史文化' },
                    { value: '自然风光', label: '自然风光' },
                    { value: '亲子家庭', label: '亲子家庭' },
                    { value: '祈福礼佛', label: '祈福礼佛' },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="sortOrder" label="排序">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="enabled" label="游客端展示" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="duration" label="建议时长">
                <Input placeholder="如 4小时" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="distance" label="预计距离">
                <Input placeholder="如 2.4公里" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="intensity" label="步行强度">
                <Select
                  options={[
                    { value: '轻松少走', label: '轻松少走' },
                    { value: '舒缓步行', label: '舒缓步行' },
                    { value: '深度步行', label: '深度步行' },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="bestTime" label="推荐时间段">
            <Input placeholder="如 10:00-15:00，匹配演出场次" />
          </Form.Item>
          <Form.Item name="reason" label="推荐理由">
            <Input.TextArea rows={3} placeholder="说明路线适合什么游客、解决什么游览需求" />
          </Form.Item>
          <Form.Item name="tags" label="路线标签">
            <Select mode="tags" placeholder="输入标签后回车，例如 亲子、少走路、演出优先" />
          </Form.Item>

          <Divider>路线节点</Divider>
          <Form.List name="nodes">
            {(fields, { add, remove }) => (
              <Space direction="vertical" style={{ width: '100%' }}>
                {fields.map((field, index) => (
                  <Card
                    key={field.key}
                    size="small"
                    title={`节点 ${index + 1}`}
                    extra={<Button type="link" danger onClick={() => remove(field.name)}>删除</Button>}
                  >
                    <Row gutter={12}>
                      <Col span={8}>
                        <Form.Item name={[field.name, 'name']} label="节点名称">
                          <Input placeholder="九龙灌浴" />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item name={[field.name, 'type']} label="类型">
                          <Select
                            options={[
                              { value: 'spot', label: '景点' },
                              { value: 'show', label: '演出' },
                              { value: 'food', label: '餐饮' },
                              { value: 'entrance', label: '入口' },
                            ]}
                          />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item name={[field.name, 'stay']} label="停留时间">
                          <Input placeholder="30分钟" />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Row gutter={12}>
                      <Col span={8}>
                        <Form.Item name={[field.name, 'spotRefId']} label="关联景点ID">
                          <Input placeholder="未来关联 scenic_spot.id" />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item name={[field.name, 'coordinate', 'longitude']} label="经度">
                          <InputNumber precision={7} style={{ width: '100%' }} placeholder="120.1009" />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item name={[field.name, 'coordinate', 'latitude']} label="纬度">
                          <InputNumber precision={7} style={{ width: '100%' }} placeholder="31.4259" />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Form.Item name={[field.name, 'summary']} label="节点讲解">
                      <Input.TextArea rows={2} placeholder="这一站的讲解重点和体验说明" />
                    </Form.Item>
                    <Form.Item name={[field.name, 'required']} label="必经节点" valuePropName="checked">
                      <Switch />
                    </Form.Item>
                  </Card>
                ))}
                <Button type="dashed" onClick={() => add({ type: 'spot', required: true })} block>
                  添加路线节点
                </Button>
              </Space>
            )}
          </Form.List>

          <Divider>沿途服务设施</Divider>
          <Form.List name="facilities">
            {(fields, { add, remove }) => (
              <Space direction="vertical" style={{ width: '100%' }}>
                {fields.map((field, index) => (
                  <Card
                    key={field.key}
                    size="small"
                    title={`设施 ${index + 1}`}
                    extra={<Button type="link" danger onClick={() => remove(field.name)}>删除</Button>}
                  >
                    <Row gutter={12}>
                      <Col span={8}>
                        <Form.Item name={[field.name, 'name']} label="设施名称">
                          <Input placeholder="梵宫素斋" />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item name={[field.name, 'category']} label="设施分类">
                          <Select
                            options={[
                              { value: 'food', label: '餐饮' },
                              { value: 'wc', label: '卫生间' },
                              { value: 'service', label: '服务' },
                              { value: 'transport', label: '交通' },
                              { value: 'medical', label: '医务' },
                            ]}
                          />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item name={[field.name, 'distance']} label="距离">
                          <Input placeholder="约80米" />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Row gutter={12}>
                      <Col span={8}>
                        <Form.Item name={[field.name, 'nearNode']} label="关联节点名称">
                          <Input placeholder="灵山梵宫" />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item name={[field.name, 'nearNodeId']} label="关联节点ID">
                          <Input placeholder="node-106" />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item name={[field.name, 'linkedFacilityId']} label="关联设施ID">
                          <Input placeholder="未来关联 scenic_facilities.id" />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Row gutter={12}>
                      <Col span={12}>
                        <Form.Item name={[field.name, 'coordinate', 'longitude']} label="设施经度">
                          <InputNumber precision={7} style={{ width: '100%' }} placeholder="120.1009" />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item name={[field.name, 'coordinate', 'latitude']} label="设施纬度">
                          <InputNumber precision={7} style={{ width: '100%' }} placeholder="31.4259" />
                        </Form.Item>
                      </Col>
                    </Row>
                  </Card>
                ))}
                <Button type="dashed" onClick={() => add({ category: 'service' })} block>
                  添加沿途设施
                </Button>
              </Space>
            )}
          </Form.List>
        </Form>
      </Drawer>
    </>
  )
}
