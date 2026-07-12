import { useEffect, useMemo, useState } from 'react'
import {
  Button,
  Card,
  ConfigProvider,
  Drawer,
  Form,
  Input,
  InputNumber,
  Pagination,
  Popconfirm,
  Space,
  Table,
  message,
} from 'antd'
import type { TableColumnsType } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import {
  createScenicCategory,
  deleteScenicCategory,
  getScenicCategories,
  type ScenicCategory,
  updateScenicCategory,
} from '../../api/scenic'

type CategoryFormValues = {
  name: string
  sortOrder?: number
}

export default function SpotCategoryPage() {
  const [form] = Form.useForm<CategoryFormValues>()
  const [categories, setCategories] = useState<ScenicCategory[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [editingCategory, setEditingCategory] = useState<ScenicCategory | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  async function loadCategories() {
    setLoading(true)
    try {
      setCategories(await getScenicCategories())
    } catch {
      message.error('加载分类失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial backend fetch updates the category request state
    void loadCategories()
  }, [])

  const filteredCategories = useMemo(() => {
    const normalized = keyword.trim().toLowerCase()
    if (!normalized) {
      return categories
    }
    return categories.filter((item) => item.name.toLowerCase().includes(normalized))
  }, [categories, keyword])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- filtering or a changed result count resets controlled pagination
    setCurrentPage(1)
  }, [keyword, categories.length])

  const pagedCategories = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredCategories.slice(start, start + pageSize)
  }, [currentPage, filteredCategories, pageSize])

  const nextSortOrder = useMemo(() => {
    if (!categories.length) {
      return 1
    }
    return Math.max(...categories.map((item) => item.sortOrder ?? 0)) + 1
  }, [categories])

  const openCreateDrawer = () => {
    setEditingCategory(null)
    form.resetFields()
    form.setFieldsValue({ sortOrder: nextSortOrder })
    setDrawerOpen(true)
  }

  const openEditDrawer = (record: ScenicCategory) => {
    setEditingCategory(record)
    form.setFieldsValue({
      name: record.name,
      sortOrder: record.sortOrder,
    })
    setDrawerOpen(true)
  }

  const closeDrawer = () => {
    setDrawerOpen(false)
    setEditingCategory(null)
    form.resetFields()
  }

  const handleSubmit = async (values: CategoryFormValues) => {
    setSaving(true)
    try {
      if (editingCategory) {
        await updateScenicCategory(editingCategory.id, values)
        message.success('分类更新成功')
      } else {
        await createScenicCategory(values)
        message.success('分类创建成功')
      }
      closeDrawer()
      await loadCategories()
    } catch (error) {
      if (error instanceof Error) {
        message.error(error.message)
      } else {
        message.error('保存分类失败')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (record: ScenicCategory) => {
    try {
      await deleteScenicCategory(record.id)
      message.success('分类删除成功')
      if (editingCategory?.id === record.id) {
        closeDrawer()
      }
      await loadCategories()
    } catch (error) {
      if (error instanceof Error) {
        message.error(error.message)
      } else {
        message.error('删除分类失败')
      }
    }
  }

  const columns: TableColumnsType<ScenicCategory> = [
    { title: '排序值', dataIndex: 'sortOrder', width: 160 },
    { title: '分类名称', dataIndex: 'name', width: 320 },
    {
      title: '操作',
      width: 180,
      render: (_, record) => (
        <Space size="middle">
          <Button type="link" icon={<EditOutlined />} onClick={() => openEditDrawer(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确认删除该分类吗？"
            description="如果该分类下仍有关联设施，后端会阻止删除。"
            onConfirm={() => void handleDelete(record)}
            okText="删除"
            cancelText="取消"
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <ConfigProvider locale={zhCN}>
      <div className="spot-cat">
        <style>{styles}</style>
        <h1 className="spot-cat__title">景点分类</h1>

        <Card className="spot-cat__card">
          <div className="spot-cat__toolbar">
            <Input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="搜索分类名称"
              allowClear
              style={{ width: 260 }}
            />
            <Button icon={<ReloadOutlined />} onClick={() => void loadCategories()} loading={loading}>
              刷新
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              className="spot-cat__btn-add"
              onClick={openCreateDrawer}
            >
              新增分类
            </Button>
          </div>

          <Table
            rowKey="id"
            columns={columns}
            dataSource={pagedCategories}
            loading={loading}
            pagination={false}
            locale={{ emptyText: '暂无分类数据' }}
          />

          <div className="spot-cat__pagination">
            <Pagination
              current={currentPage}
              pageSize={pageSize}
              total={filteredCategories.length}
              showSizeChanger
              pageSizeOptions={['10', '20', '50']}
              showTotal={(total) => `共 ${total} 条`}
              onChange={(page, size) => {
                setCurrentPage(page)
                setPageSize(size)
              }}
              onShowSizeChange={(_, size) => {
                setCurrentPage(1)
                setPageSize(size)
              }}
            />
          </div>
        </Card>

        <Drawer
          title={editingCategory ? '编辑分类' : '新增分类'}
          open={drawerOpen}
          width={420}
          onClose={closeDrawer}
          destroyOnClose
        >
          <Form
            form={form}
            layout="vertical"
            initialValues={{ sortOrder: nextSortOrder }}
            onFinish={(values) => void handleSubmit(values)}
          >
            <Form.Item label="分类名称" name="name" rules={[{ required: true, message: '请输入分类名称' }]}>
              <Input placeholder="例如：游客服务、卫生设施" />
            </Form.Item>

            <Form.Item label="排序值" name="sortOrder">
              <InputNumber min={0} style={{ width: '100%' }} placeholder="默认 0" />
            </Form.Item>

            <div className="spot-cat__form-footer">
              <Button onClick={closeDrawer}>
                取消
              </Button>
              <Button type="primary" htmlType="submit" loading={saving}>
                {editingCategory ? '保存修改' : '创建分类'}
              </Button>
            </div>
          </Form>
        </Drawer>
      </div>
    </ConfigProvider>
  )
}

const styles = `
.spot-cat {
  display: flex;
  flex-direction: column;
  padding: 0;
  background: #f6f8fb;
  min-height: calc(100vh - 56px - 36px);
  box-sizing: border-box;
}
.spot-cat__title {
  font-size: 28px;
  font-weight: 700;
  margin: 0 0 20px;
  color: #1f1f1f;
}
.spot-cat__card {
  width: 100%;
  border-radius: 12px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}
.spot-cat__toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 20px;
}
.spot-cat__btn-add {
  margin-left: auto;
}
.spot-cat__pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
}
.spot-cat__form-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
}
`
