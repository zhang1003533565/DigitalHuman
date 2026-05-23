import { useState } from 'react'
import {
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Radio,
  Select,
  Table,
  Tag,
  Row,
  Col,
} from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import type { TableColumnsType } from 'antd'

type CategoryRow = {
  key: string
  name: string
  code: string
  sort: number
  spotCount: number
  status: '启用' | '停用'
  createdAt: string
}

const mockData: CategoryRow[] = [
  { key: '1', name: '历史文化', code: 'CAT001', sort: 1, spotCount: 28, status: '启用', createdAt: '2024-05-10 10:23' },
  { key: '2', name: '自然风光', code: 'CAT002', sort: 2, spotCount: 32, status: '启用', createdAt: '2024-05-10 10:25' },
  { key: '3', name: '亲子研学', code: 'CAT003', sort: 3, spotCount: 18, status: '启用', createdAt: '2024-05-11 09:15' },
  { key: '4', name: '网红打卡', code: 'CAT004', sort: 4, spotCount: 22, status: '启用', createdAt: '2024-05-11 09:18' },
  { key: '5', name: '夜游演艺', code: 'CAT005', sort: 5, spotCount: 12, status: '启用', createdAt: '2024-05-12 14:32' },
]

const columns: TableColumnsType<CategoryRow> = [
  { title: '分类名称', dataIndex: 'name', width: 120 },
  { title: '分类编码', dataIndex: 'code', width: 120 },
  { title: '排序', dataIndex: 'sort', width: 70, align: 'center' },
  { title: '关联景点数', dataIndex: 'spotCount', width: 100, align: 'center' },
  {
    title: '状态',
    dataIndex: 'status',
    width: 80,
    render: (status: string) => (
      <Tag color={status === '启用' ? 'blue' : 'default'}>{status}</Tag>
    ),
  },
  { title: '创建时间', dataIndex: 'createdAt', width: 160 },
  {
    title: '操作',
    width: 160,
    render: () => (
      <div className="spot-cat__actions">
        <a className="spot-cat__action-link">查看</a>
        <a className="spot-cat__action-link">编辑</a>
        <a className="spot-cat__action-link spot-cat__action-link--danger">删除</a>
      </div>
    ),
  },
]

function SpotCategoryPage() {
  const [form] = Form.useForm()
  const [showForm, setShowForm] = useState(true)

  const handleCancel = () => {
    form.resetFields()
  }

  const handleSave = () => {
    // 纯前端，暂不提交
  }

  return (
    <div className="spot-cat">
      <style>{styles}</style>

      {/* 页面标题 */}
      <h1 className="spot-cat__title">景点分类管理</h1>

      <Row gutter={16} className="spot-cat__row">
        {/* 左侧：搜索 + 表格 */}
        <Col span={16} className="spot-cat__col">
          <Card className="spot-cat__card spot-cat__card--main">
            {/* 搜索栏 */}
            <div className="spot-cat__filter-bar">
              <div className="spot-cat__filter-item">
                <span className="spot-cat__filter-label">分类名称</span>
                <Input
                  placeholder="请输入分类名称"
                  suffix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                  style={{ width: 200 }}
                />
              </div>
              <div className="spot-cat__filter-item">
                <span className="spot-cat__filter-label">状态</span>
                <Select
                  placeholder="全部状态"
                  defaultValue="all"
                  style={{ width: 140 }}
                  options={[
                    { value: 'all', label: '全部状态' },
                    { value: 'enabled', label: '启用' },
                    { value: 'disabled', label: '停用' },
                  ]}
                />
              </div>
              <Button type="primary">查询</Button>
              <Button>重置</Button>
              <Button
                type="primary"
                className="spot-cat__btn-add"
                onClick={() => setShowForm(true)}
              >
                新增分类
              </Button>
            </div>

            {/* 表格 */}
            <Table
              columns={columns}
              dataSource={mockData}
              pagination={{
                total: 5,
                pageSize: 10,
                showTotal: (total) => `共 ${total} 条`,
                showSizeChanger: true,
                showQuickJumper: true,
              }}
              size="middle"
            />
          </Card>
        </Col>

        {/* 右侧：新增分类表单 */}
        {showForm && (
          <Col span={8} className="spot-cat__col">
            <Card className="spot-cat__card spot-cat__card--side" title="新增分类">
              <Form
                form={form}
                layout="vertical"
                initialValues={{ sort: 1, status: 'enabled' }}
              >
                <Form.Item
                  label="分类名称"
                  name="name"
                  required
                >
                  <Input placeholder="请输入分类名称" />
                </Form.Item>

                <Form.Item
                  label="分类编码"
                  name="code"
                  required
                >
                  <Input placeholder="请输入分类编码 (如: CAT001)" />
                </Form.Item>

                <Form.Item
                  label="排序"
                  name="sort"
                  required
                >
                  <InputNumber min={1} style={{ width: 140 }} />
                </Form.Item>

                <Form.Item
                  label="父级分类（可选）"
                  name="parentId"
                >
                  <Select
                    placeholder="请选择父级分类"
                    allowClear
                    options={[
                      { value: '1', label: '历史文化' },
                      { value: '2', label: '自然风光' },
                      { value: '3', label: '亲子研学' },
                      { value: '4', label: '网红打卡' },
                      { value: '5', label: '夜游演艺' },
                    ]}
                  />
                </Form.Item>

                <Form.Item
                  label="状态"
                  name="status"
                  required
                >
                  <Radio.Group>
                    <Radio value="enabled">启用</Radio>
                    <Radio value="disabled">停用</Radio>
                  </Radio.Group>
                </Form.Item>

                <div className="spot-cat__form-footer">
                  <Button onClick={handleCancel}>取消</Button>
                  <Button type="primary" onClick={handleSave}>保存分类</Button>
                </div>
              </Form>
            </Card>
          </Col>
        )}
      </Row>
    </div>
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
  line-height: 1.2;
}
.spot-cat__row {
  flex: 1 1 auto;
  align-items: stretch;
}
.spot-cat__col {
  display: flex;
}
.spot-cat__card {
  border-radius: 12px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  width: 100%;
  display: flex;
  flex-direction: column;
}
.spot-cat__card :where(.ant-card-body) {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  padding: 24px 28px;
}
.spot-cat__card--main :where(.ant-table-wrapper) {
  flex: 1 1 auto;
}
.spot-cat__card--side :where(.ant-card-head) {
  padding: 16px 28px;
  font-size: 18px;
}
.spot-cat__card--side :where(.ant-form-item-label) > label {
  font-size: 15px;
  height: 32px;
}
.spot-cat__card--side :where(.ant-input),
.spot-cat__card--side :where(.ant-select-selector),
.spot-cat__card--side :where(.ant-input-number) {
  height: 40px;
  font-size: 14px;
}
.spot-cat__card--side :where(.ant-select-selection-item),
.spot-cat__card--side :where(.ant-select-selection-placeholder) {
  line-height: 38px !important;
}
.spot-cat__card--side :where(.ant-input-number-input) {
  height: 38px;
}
.spot-cat__filter-bar {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}
.spot-cat__filter-bar :where(.ant-btn) {
  height: 38px;
  padding: 0 20px;
  font-size: 14px;
}
.spot-cat__filter-bar :where(.ant-input-affix-wrapper),
.spot-cat__filter-bar :where(.ant-select-selector) {
  height: 38px !important;
}
.spot-cat__filter-bar :where(.ant-select-selection-item),
.spot-cat__filter-bar :where(.ant-select-selection-placeholder) {
  line-height: 36px !important;
}
.spot-cat__filter-item {
  display: flex;
  align-items: center;
  gap: 8px;
}
.spot-cat__filter-label {
  font-size: 14px;
  color: #333;
  white-space: nowrap;
}
.spot-cat__btn-add {
  margin-left: auto;
  background: #1d2b4f !important;
  border-color: #1d2b4f !important;
}
.spot-cat__btn-add:hover {
  background: #2a3d6b !important;
  border-color: #2a3d6b !important;
}
.spot-cat__actions {
  display: flex;
  gap: 12px;
}
.spot-cat__action-link {
  color: #1677ff;
  cursor: pointer;
}
.spot-cat__action-link:hover {
  color: #4096ff;
}
.spot-cat__action-link--danger {
  color: #ff4d4f;
}
.spot-cat__action-link--danger:hover {
  color: #ff7875;
}
.spot-cat__form-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: auto;
  padding-top: 16px;
}
.spot-cat__form-footer :where(.ant-btn) {
  height: 40px;
  padding: 0 24px;
  font-size: 15px;
}
.spot-cat :where(.ant-table-thead) > tr > th {
  font-size: 14px;
  padding: 14px 12px;
  background: #fafbfc;
}
.spot-cat :where(.ant-table-tbody) > tr > td {
  padding: 16px 12px;
  font-size: 14px;
}
`

export default SpotCategoryPage
