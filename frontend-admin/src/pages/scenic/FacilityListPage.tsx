import { useEffect, useMemo, useState } from 'react'
import { Button, Input, Popconfirm, Select, Space, Table, message } from 'antd'
import type { TableColumnsType } from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import SpotDrawer from './SpotAddPage'
import {
  deleteScenicFacility,
  getScenicCategories,
  getScenicFacilities,
  type ScenicCategory,
  type ScenicFacility,
} from '../../api/scenic'

export default function FacilityListPage() {
  const [facilities, setFacilities] = useState<ScenicFacility[]>([])
  const [categories, setCategories] = useState<ScenicCategory[]>([])
  const [loading, setLoading] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<number | 'all'>('all')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingFacility, setEditingFacility] = useState<ScenicFacility | null>(null)

  async function loadPageData() {
    setLoading(true)
    try {
      const [facilityData, categoryData] = await Promise.all([
        getScenicFacilities(),
        getScenicCategories(),
      ])
      setFacilities(facilityData)
      setCategories(categoryData)
    } catch {
      message.error('加载设施列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadPageData()
  }, [])

  const filteredFacilities = useMemo(() => {
    const normalized = keyword.trim().toLowerCase()
    return facilities.filter((item) => {
      const matchesKeyword = !normalized
        || item.name.toLowerCase().includes(normalized)
        || item.categoryName.toLowerCase().includes(normalized)
      const matchesCategory = categoryFilter === 'all' || item.categoryId === categoryFilter
      return matchesKeyword && matchesCategory
    })
  }, [categoryFilter, facilities, keyword])

  const handleDelete = async (record: ScenicFacility) => {
    try {
      await deleteScenicFacility(record.id)
      message.success('设施删除成功')
      await loadPageData()
    } catch (error) {
      if (error instanceof Error) {
        message.error(error.message)
      } else {
        message.error('删除设施失败')
      }
    }
  }

  const columns: TableColumnsType<ScenicFacility> = [
    {
      title: '设施图片',
      width: 110,
      render: (_, record) => {
        const previewImage = record.image || record.galleryImages[0]
        return previewImage ? (
          <img
            src={previewImage}
            alt="设施图片"
            style={{
              width: 64,
              height: 64,
              objectFit: 'cover',
              borderRadius: 8,
              border: '1px solid #f0f0f0',
            }}
          />
        ) : (
          <span style={{ color: '#bfbfbf' }}>暂无</span>
        )
      },
    },
    { title: '设施名称', dataIndex: 'name', width: 220 },
    { title: '分类', dataIndex: 'categoryName', width: 180 },
    { title: '经度', dataIndex: 'longitude', width: 140 },
    { title: '纬度', dataIndex: 'latitude', width: 140 },
    {
      title: '开放时间',
      width: 180,
      render: (_, record) => {
        if (!record.openTime && !record.closeTime) {
          return '-'
        }
        return `${record.openTime ?? '--:--:--'} ~ ${record.closeTime ?? '--:--:--'}`
      },
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      width: 180,
      render: (value: string) => new Date(value).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      width: 180,
      render: (_, record) => (
        <Space size="middle">
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => {
              setEditingFacility(record)
              setDrawerOpen(true)
            }}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除该设施吗？"
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
    <div className="fac-list">
      <style>{styles}</style>
      <SpotDrawer
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false)
          setEditingFacility(null)
        }}
        title={editingFacility ? '编辑设施' : '新增设施'}
        actionText={editingFacility ? '保存修改' : '创建设施'}
        categories={categories}
        initialData={editingFacility}
        onSuccess={loadPageData}
      />

      <h1 className="fac-list__title">全部设施</h1>

      <div className="fac-list__filter-row">
        <Input
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="按设施名称或分类搜索"
          suffix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
          allowClear
          style={{ width: 280 }}
        />
        <Select
          value={categoryFilter}
          onChange={(value) => setCategoryFilter(value)}
          style={{ width: 220 }}
          options={[
            { value: 'all', label: '全部分类' },
            ...categories.map((item) => ({ value: item.id, label: item.name })),
          ]}
        />
        <Button icon={<ReloadOutlined />} onClick={() => void loadPageData()} loading={loading}>
          刷新
        </Button>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          className="fac-list__btn-add"
          onClick={() => {
            setEditingFacility(null)
            setDrawerOpen(true)
          }}
        >
          新增设施
        </Button>
      </div>

      <div className="fac-list__table-card">
        <Table
          rowKey="id"
          columns={columns}
          dataSource={filteredFacilities}
          loading={loading}
          pagination={{ pageSize: 10, showSizeChanger: true }}
        />
      </div>
    </div>
  )
}

const styles = `
.fac-list {
  padding: 0 0 24px;
  background: #f5f7fa;
  min-height: 100%;
}
.fac-list__title {
  font-size: 26px;
  font-weight: 700;
  margin: 0 0 18px;
  color: #1f1f1f;
}
.fac-list__filter-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}
.fac-list__btn-add {
  margin-left: auto;
}
.fac-list__table-card {
  background: #fff;
  border-radius: 10px;
  padding: 16px 24px 20px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}
`
