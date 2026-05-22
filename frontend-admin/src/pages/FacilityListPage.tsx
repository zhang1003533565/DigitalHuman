import { useState } from 'react'
import {
  Button,
  Checkbox,
  Input,
  Pagination,
  Select,
  Table,
  Tag,
} from 'antd'
import type { TableColumnsType } from 'antd'
import {
  DeleteOutlined,
  DownloadOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons'

type FacilityRow = {
  key: string
  name: string
  spot: string
  category: string
  area: string
  status: '启用' | '停用'
  updatedAt: string
}

const mockFacilities: FacilityRow[] = [
  { key: '1', name: '游客服务中心', spot: '灵山大佛', category: '游客服务', area: '景区入口东侧', status: '启用', updatedAt: '2024-05-20 14:32' },
  { key: '2', name: '停车场A区', spot: '灵山大佛', category: '交通配套', area: '北门停车区', status: '启用', updatedAt: '2024-05-20 11:18' },
  { key: '3', name: '公共卫生间1号', spot: '拈花湾', category: '公共设施', area: '主街中段', status: '启用', updatedAt: '2024-05-19 16:40' },
  { key: '4', name: '医疗急救点', spot: '九龙瀑谷', category: '安全服务', area: '游步道入口', status: '启用', updatedAt: '2024-05-19 09:52' },
  { key: '5', name: '观光车乘车点', spot: '灵山梵宫', category: '交通配套', area: '广场南侧', status: '停用', updatedAt: '2024-05-18 15:06' },
  { key: '6', name: '自动售货机B02', spot: '香月花街', category: '商业便民', area: '西侧休闲区', status: '启用', updatedAt: '2024-05-18 10:22' },
  { key: '7', name: '无障碍电梯', spot: '五印坛城', category: '无障碍设施', area: '1号楼北侧', status: '启用', updatedAt: '2024-05-17 13:47' },
  { key: '8', name: '景区导览屏', spot: '曼陀罗园', category: '智慧导览', area: '中心广场', status: '启用', updatedAt: '2024-05-17 09:10' },
]

const columns: TableColumnsType<FacilityRow> = [
  { title: '设施名称', dataIndex: 'name', width: 160 },
  { title: '所属景点', dataIndex: 'spot', width: 140 },
  { title: '设施分类', dataIndex: 'category', width: 140 },
  { title: '位置区域', dataIndex: 'area', width: 160 },
  {
    title: '状态',
    dataIndex: 'status',
    width: 110,
    render: (status: FacilityRow['status']) => (
      <span className={`fac-list__status fac-list__status--${status === '启用' ? 'on' : 'off'}`}>
        <span className="fac-list__status-dot" />
        {status}
      </span>
    ),
  },
  { title: '更新时间', dataIndex: 'updatedAt', width: 180 },
  {
    title: '操作',
    width: 160,
    render: () => (
      <div className="fac-list__actions">
        <a className="fac-list__action-link">查看</a>
        <a className="fac-list__action-link">编辑</a>
        <a className="fac-list__action-link fac-list__action-link--danger">删除</a>
      </div>
    ),
  },
]

function FacilityListPage() {
  const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([])
  const [current, setCurrent] = useState(1)

  return (
    <div className="fac-list">
      <style>{styles}</style>

      <h1 className="fac-list__title">全部设施总览</h1>

      {/* 筛选栏 */}
      <div className="fac-list__filter">
        <div className="fac-list__filter-row">
          <div className="fac-list__filter-item">
            <span className="fac-list__filter-label">设施名称</span>
            <Input
              placeholder="请输入设施名称"
              suffix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
            />
          </div>
          <div className="fac-list__filter-item">
            <span className="fac-list__filter-label">所属景点</span>
            <Select
              placeholder="全部景点"
              defaultValue="all"
              options={[
                { value: 'all', label: '全部景点' },
                { value: 'lingshan', label: '灵山大佛' },
                { value: 'nianhua', label: '拈花湾' },
                { value: 'jiulong', label: '九龙瀑谷' },
                { value: 'fangong', label: '灵山梵宫' },
              ]}
            />
          </div>
          <div className="fac-list__filter-item">
            <span className="fac-list__filter-label">设施分类</span>
            <Select
              placeholder="全部分类"
              defaultValue="all"
              options={[
                { value: 'all', label: '全部分类' },
                { value: 'service', label: '游客服务' },
                { value: 'traffic', label: '交通配套' },
                { value: 'public', label: '公共设施' },
                { value: 'safety', label: '安全服务' },
                { value: 'business', label: '商业便民' },
                { value: 'guide', label: '智慧导览' },
              ]}
            />
          </div>
          <div className="fac-list__filter-item">
            <span className="fac-list__filter-label">状态</span>
            <Select
              placeholder="全部状态"
              defaultValue="all"
              options={[
                { value: 'all', label: '全部状态' },
                { value: 'enabled', label: '启用' },
                { value: 'disabled', label: '停用' },
              ]}
            />
          </div>
          <div className="fac-list__filter-actions">
            <Button type="primary" icon={<SearchOutlined />}>查询</Button>
            <Button icon={<ReloadOutlined />}>重置</Button>
            <Button type="primary" icon={<PlusOutlined />} className="fac-list__btn-add">
              新增设施
            </Button>
          </div>
        </div>
      </div>

      {/* 表格区域 */}
      <div className="fac-list__table-card">
        <div className="fac-list__toolbar">
          <Button danger icon={<DeleteOutlined />} className="fac-list__btn-batch">
            批量删除
          </Button>
          <Button icon={<DownloadOutlined />}>导出</Button>
        </div>

        <Table
          rowSelection={{
            selectedRowKeys: selectedKeys,
            onChange: (keys) => setSelectedKeys(keys),
          }}
          columns={columns}
          dataSource={mockFacilities}
          pagination={false}
          size="middle"
        />

        <div className="fac-list__pagination">
          <span className="fac-list__total">共 128 条</span>
          <div className="fac-list__pager">
            <Pagination
              current={current}
              total={128}
              pageSize={10}
              showSizeChanger
              showQuickJumper
              onChange={(page) => setCurrent(page)}
            />
          </div>
        </div>
      </div>

      {/* 仅用于让 antd Tag/Checkbox 引入不报未使用警告（实际未使用占位） */}
      <span style={{ display: 'none' }}>
        <Tag />
        <Checkbox />
      </span>
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
  line-height: 1.2;
}
.fac-list__filter {
  background: #fff;
  border-radius: 10px;
  padding: 20px 24px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  margin-bottom: 16px;
}
.fac-list__filter-row {
  display: flex;
  align-items: flex-end;
  gap: 20px;
  flex-wrap: wrap;
}
.fac-list__filter-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 180px;
  flex: 1 1 180px;
}
.fac-list__filter-label {
  font-size: 14px;
  color: #1f1f1f;
}
.fac-list__filter-item :where(.ant-input-affix-wrapper),
.fac-list__filter-item :where(.ant-select-selector),
.fac-list__filter-item :where(.ant-input) {
  height: 40px !important;
}
.fac-list__filter-item :where(.ant-select-selection-item),
.fac-list__filter-item :where(.ant-select-selection-placeholder) {
  line-height: 38px !important;
}
.fac-list__filter-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-left: auto;
  padding-bottom: 0;
}
.fac-list__filter-actions :where(.ant-btn) {
  height: 40px;
  padding: 0 18px;
}
.fac-list__btn-add {
  background: #1677ff !important;
  border-color: #1677ff !important;
}
.fac-list__table-card {
  background: #fff;
  border-radius: 10px;
  padding: 16px 24px 20px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}
.fac-list__toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0 16px;
}
.fac-list__btn-batch {
  background: #fff1f0 !important;
  border-color: #ffa39e !important;
  color: #ff4d4f !important;
}
.fac-list__btn-batch:hover {
  background: #ffe7e6 !important;
  color: #ff4d4f !important;
}
.fac-list :where(.ant-table-thead) > tr > th {
  background: #fafbfc;
  font-weight: 600;
  font-size: 14px;
}
.fac-list :where(.ant-table-tbody) > tr > td {
  padding: 16px 12px;
  font-size: 14px;
}
.fac-list__status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 13px;
}
.fac-list__status--on {
  background: #e7f7ec;
  color: #29a35a;
}
.fac-list__status--off {
  background: #fdecec;
  color: #e34d4d;
}
.fac-list__status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}
.fac-list__actions {
  display: flex;
  gap: 12px;
}
.fac-list__action-link {
  color: #1677ff;
  cursor: pointer;
}
.fac-list__action-link:hover {
  color: #4096ff;
}
.fac-list__action-link--danger {
  color: #ff4d4f;
}
.fac-list__action-link--danger:hover {
  color: #ff7875;
}
.fac-list__pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 16px;
}
.fac-list__total {
  font-size: 14px;
  color: #666;
}
.fac-list__pager :where(.ant-pagination-item-active) {
  background: #1677ff;
  border-color: #1677ff;
}
.fac-list__pager :where(.ant-pagination-item-active) a {
  color: #fff;
}
`

export default FacilityListPage
