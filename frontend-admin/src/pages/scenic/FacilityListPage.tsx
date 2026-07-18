import { useEffect, useMemo, useState } from 'react'
import {
  Button,
  ConfigProvider,
  Descriptions,
  Drawer,
  Input,
  Popconfirm,
  Select,
  Space,
  Table,
  message,
} from 'antd'
import type { TableColumnsType } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import {
  DeleteOutlined,
  EditOutlined,
  EnvironmentOutlined,
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  SettingOutlined,
  CloseOutlined,
} from '@ant-design/icons'
import SpotDrawer from './SpotAddPage'
import FacilityContentDrawer from './components/FacilityContentDrawer'
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
  const [viewingFacility, setViewingFacility] = useState<ScenicFacility | null>(null)
  const [contentFacility, setContentFacility] = useState<ScenicFacility | null>(null)

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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial backend fetch updates the page's request state
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
      width: 330,
      render: (_, record) => (
        <Space size="middle">
          <Button type="link" icon={<EyeOutlined />} onClick={() => setViewingFacility(record)}>
            查看
          </Button>
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
          <Button type="link" icon={<SettingOutlined />} onClick={() => setContentFacility(record)}>
            内容配置
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
    <ConfigProvider locale={zhCN}>
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

        <FacilityContentDrawer
          facility={contentFacility}
          open={Boolean(contentFacility)}
          onClose={() => setContentFacility(null)}
          onSaved={loadPageData}
        />

        <Drawer
          title={viewingFacility ? (
            <div className="fac-list__drawer-header">
              <div className="fac-list__drawer-caption">已配置景点详情</div>
              <div className="fac-list__drawer-title">{viewingFacility.name}</div>
              <div className="fac-list__drawer-meta">
                <span className="fac-list__drawer-category">
                  <EnvironmentOutlined />
                  <span>{viewingFacility.categoryName}</span>
                </span>
              </div>
            </div>
          ) : '设施详情'}
          open={Boolean(viewingFacility)}
          width={720}
          onClose={() => setViewingFacility(null)}
          closable={false}
          extra={(
            <Button
              type="text"
              icon={<CloseOutlined />}
              className="fac-list__drawer-close"
              onClick={() => setViewingFacility(null)}
            />
          )}
        >
          {viewingFacility ? (
            <div className="fac-list__detail">
              <div className="fac-list__detail-gallery">
                {(viewingFacility.image || viewingFacility.galleryImages.length > 0) ? (
                  <>
                    {viewingFacility.image ? (
                      <div className="fac-list__detail-cover">
                        <img src={viewingFacility.image} alt={viewingFacility.name} />
                      </div>
                    ) : null}
                    {viewingFacility.galleryImages.length ? (
                      <div className="fac-list__detail-grid">
                        {viewingFacility.galleryImages.map((item, index) => (
                          <img key={`${item}-${index}`} src={item} alt={`${viewingFacility.name}-${index + 1}`} />
                        ))}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="fac-list__detail-empty">暂无图片</div>
                )}
              </div>
              <Descriptions bordered column={2}>
                <Descriptions.Item label="设施名称">{viewingFacility.name}</Descriptions.Item>
                <Descriptions.Item label="景点编码">{viewingFacility.spotCode || '-'}</Descriptions.Item>
                <Descriptions.Item label="分类">{viewingFacility.categoryName}</Descriptions.Item>
                <Descriptions.Item label="地图显示">{viewingFacility.mapVisible ? '显示' : '隐藏'}</Descriptions.Item>
                <Descriptions.Item label="位置说明" span={2}>{viewingFacility.locationDescription || '-'}</Descriptions.Item>
                <Descriptions.Item label="简短介绍" span={2}>{viewingFacility.shortDescription || '-'}</Descriptions.Item>
                <Descriptions.Item label="经度">{viewingFacility.longitude}</Descriptions.Item>
                <Descriptions.Item label="纬度">{viewingFacility.latitude}</Descriptions.Item>
                <Descriptions.Item label="开放时间" span={2}>
                  {viewingFacility.openTime || viewingFacility.closeTime
                    ? `${viewingFacility.openTime ?? '--:--:--'} ~ ${viewingFacility.closeTime ?? '--:--:--'}`
                    : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="创建时间">
                  {new Date(viewingFacility.createdAt).toLocaleString('zh-CN')}
                </Descriptions.Item>
                <Descriptions.Item label="更新时间">
                  {new Date(viewingFacility.updatedAt).toLocaleString('zh-CN')}
                </Descriptions.Item>
              </Descriptions>
            </div>
          ) : null}
        </Drawer>

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
            tableLayout="fixed"
            scroll={{ x: 1450 }}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              locale: { items_per_page: '条/页' },
            }}
          />
        </div>
      </div>
    </ConfigProvider>
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
.fac-list__detail {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.fac-list__drawer-header {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.fac-list__drawer-close {
  font-size: 18px;
}
.fac-list__drawer-close:hover {
  color: #111827;
}
.fac-list__drawer-caption {
  font-size: 14px;
  font-weight: 600;
  color: #6b7280;
}
.fac-list__drawer-title {
  font-size: 48px;
  font-weight: 800;
  line-height: 1.05;
  letter-spacing: -1px;
  color: #111827;
}
.fac-list__drawer-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  font-size: 14px;
  color: #4b5563;
}
.fac-list__drawer-category {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.fac-list__detail-gallery {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.fac-list__detail-cover img {
  width: 100%;
  max-height: 280px;
  object-fit: cover;
  border-radius: 10px;
  border: 1px solid #f0f0f0;
}
.fac-list__detail-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}
.fac-list__detail-grid img {
  width: 100%;
  aspect-ratio: 1 / 1;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid #f0f0f0;
}
.fac-list__detail-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 180px;
  border-radius: 10px;
  background: #fafafa;
  color: #bfbfbf;
  border: 1px dashed #d9d9d9;
}
`
