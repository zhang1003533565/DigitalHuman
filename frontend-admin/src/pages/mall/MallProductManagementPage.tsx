import { useMemo, useState } from 'react'
import {
  Button,
  Card,
  Drawer,
  Form,
  Image,
  Input,
  InputNumber,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Upload,
  message,
} from 'antd'
import type { TableColumnsType, UploadProps } from 'antd'
import { PlusOutlined, ReloadOutlined, UploadOutlined } from '@ant-design/icons'
import { useDeferredMount } from '../../hooks/useDeferredMount'
import {
  MALL_CATEGORY_OPTIONS,
  createProduct,
  deleteProduct,
  listProducts,
  updateProduct,
  uploadProductImage,
  type MallProduct,
  type MallProductPayload,
} from '../../api/mall'

const CATEGORY_LABEL_MAP: Record<string, string> = Object.fromEntries(
  MALL_CATEGORY_OPTIONS.map((option) => [option.value, option.label]),
)

/** 与前台"仅剩 N 件"提示保持一致的阈值。 */
const LOW_STOCK_THRESHOLD = 10

type StockFilter = 'all' | 'low' | 'out' | 'disabled'

const STOCK_FILTER_OPTIONS: { value: StockFilter; label: string }[] = [
  { value: 'all', label: '全部商品' },
  { value: 'low', label: '库存紧张' },
  { value: 'out', label: '已售罄' },
  { value: 'disabled', label: '已下架' },
]

function MallProductManagementPageInner() {
  const [products, setProducts] = useState<MallProduct[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<MallProduct | null>(null)
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [stockFilter, setStockFilter] = useState<StockFilter>('all')
  const [keyword, setKeyword] = useState('')
  const [form] = Form.useForm<MallProductPayload & { image?: string }>()

  async function loadProducts() {
    setLoading(true)
    try {
      setProducts(await listProducts())
    } catch {
      message.error('加载商品失败')
    } finally {
      setLoading(false)
    }
  }

  function openCreate() {
    setEditingProduct(null)
    form.resetFields()
    form.setFieldsValue({ enabled: true, sortOrder: 0, stock: 0, category: 'farm', unit: '件' })
    setDrawerOpen(true)
  }

  function openEdit(product: MallProduct) {
    setEditingProduct(product)
    form.setFieldsValue({
      name: product.name,
      category: product.category,
      price: product.price,
      originalPrice: product.originalPrice ?? undefined,
      unit: product.unit ?? undefined,
      stock: product.stock,
      image: product.image ?? undefined,
      summary: product.summary ?? undefined,
      description: product.description ?? undefined,
      tags: product.tags ?? undefined,
      sortOrder: product.sortOrder,
      enabled: product.enabled,
    })
    setDrawerOpen(true)
  }

  async function handleDelete(id: string) {
    try {
      await deleteProduct(id)
      message.success('删除成功')
      void loadProducts()
    } catch {
      message.error('删除失败')
    }
  }

  async function handleSubmit() {
    try {
      const values = await form.validateFields()
      setSaving(true)
      if (editingProduct) {
        await updateProduct(editingProduct.id, values)
        message.success('更新成功')
      } else {
        await createProduct(values)
        message.success('创建成功')
      }
      setDrawerOpen(false)
      void loadProducts()
    } catch (error) {
      if (error && typeof error === 'object' && 'errorFields' in error) {
        return
      }
      message.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  const uploadProps: UploadProps = {
    accept: 'image/png,image/jpeg,image/webp',
    showUploadList: false,
    beforeUpload: async (file) => {
      setUploading(true)
      try {
        const result = await uploadProductImage(file as File)
        form.setFieldValue('image', result.url)
        message.success('图片上传成功')
      } catch {
        message.error('图片上传失败，请确认格式为 PNG/JPG/WebP')
      } finally {
        setUploading(false)
      }
      // 阻止 antd 自动上传，改由上面的自定义请求处理
      return false
    },
  }

  const filtered = useMemo(() => {
    const term = keyword.trim().toLowerCase()
    return products.filter((product) => {
      const matchesCategory = categoryFilter === 'all' || product.category === categoryFilter
      const matchesKeyword =
        !term ||
        product.name.toLowerCase().includes(term) ||
        (product.tags ?? '').toLowerCase().includes(term)
      const matchesStock =
        stockFilter === 'all' ||
        (stockFilter === 'low' && product.stock > 0 && product.stock <= LOW_STOCK_THRESHOLD) ||
        (stockFilter === 'out' && product.stock <= 0) ||
        (stockFilter === 'disabled' && !product.enabled)
      return matchesCategory && matchesKeyword && matchesStock
    })
  }, [products, categoryFilter, stockFilter, keyword])

  /** 需要运营关注的商品数量，用于在筛选器上给出即时提示。 */
  const attentionCount = useMemo(
    () => products.filter((product) => !product.enabled || product.stock <= LOW_STOCK_THRESHOLD).length,
    [products],
  )

  const columns: TableColumnsType<MallProduct> = useMemo(
    () => [
      {
        title: '商品',
        dataIndex: 'name',
        render: (name: string, record) => (
          <Space>
            {record.image ? (
              <Image src={record.image} width={44} height={44} style={{ objectFit: 'cover', borderRadius: 6 }} preview={false} />
            ) : (
              <span className="mall-product-placeholder" aria-hidden="true">无图</span>
            )}
            <Space direction="vertical" size={0}>
              <strong>{name}</strong>
              <span className="mall-product-summary">{record.summary || '—'}</span>
            </Space>
          </Space>
        ),
      },
      {
        title: '分类',
        dataIndex: 'category',
        width: 110,
        render: (category: string) => (
          <Tag color={category === 'farm' ? 'green' : 'geekblue'}>
            {CATEGORY_LABEL_MAP[category] || category}
          </Tag>
        ),
      },
      {
        title: '价格',
        dataIndex: 'price',
        width: 140,
        render: (price: number, record) => (
          <Space direction="vertical" size={0}>
            <strong>¥{Number(price).toFixed(2)}</strong>
            {record.originalPrice ? (
              <span className="mall-product-original">¥{Number(record.originalPrice).toFixed(2)}</span>
            ) : null}
          </Space>
        ),
      },
      {
        title: '库存',
        dataIndex: 'stock',
        width: 100,
        sorter: (a, b) => a.stock - b.stock,
        render: (stock: number) => (
          <Tag color={stock > 10 ? 'green' : stock > 0 ? 'orange' : 'red'}>{stock}</Tag>
        ),
      },
      { title: '排序', dataIndex: 'sortOrder', width: 80, sorter: (a, b) => a.sortOrder - b.sortOrder },
      {
        title: '状态',
        dataIndex: 'enabled',
        width: 90,
        render: (enabled: boolean) => (
          <Tag color={enabled ? 'green' : 'default'}>{enabled ? '已上架' : '已下架'}</Tag>
        ),
      },
      {
        title: '操作',
        width: 150,
        render: (_: unknown, record) => (
          <Space>
            <Button type="link" size="small" onClick={() => openEdit(record)}>
              编辑
            </Button>
            <Popconfirm
              title="确定删除该商品？"
              onConfirm={() => void handleDelete(record.id)}
              okText="删除"
              cancelText="取消"
            >
              <Button type="link" size="small" danger>
                删除
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  useDeferredMount(() => {
    void loadProducts()
  })

  return (
    <Card
      title="景区商城商品管理"
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => void loadProducts()}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            新增商品
          </Button>
        </Space>
      }
    >
      <Space style={{ marginBottom: 16 }} wrap>
        <Input.Search
          allowClear
          placeholder="搜索商品名称或标签"
          style={{ width: 240 }}
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
        />
        <Select
          value={categoryFilter}
          style={{ width: 160 }}
          onChange={setCategoryFilter}
          options={[{ value: 'all', label: '全部分类' }, ...MALL_CATEGORY_OPTIONS]}
        />
        <Select
          value={stockFilter}
          style={{ width: 160 }}
          onChange={setStockFilter}
          options={STOCK_FILTER_OPTIONS}
        />
        <span>
          显示 {filtered.length} / {products.length} 条
        </span>
        {attentionCount > 0 ? (
          <Tag color="orange">{attentionCount} 件商品需关注库存或上架状态</Tag>
        ) : null}
      </Space>

      <Table
        columns={columns}
        dataSource={filtered}
        loading={loading}
        rowKey="id"
        scroll={{ x: 900 }}
        pagination={{ pageSize: 10, showSizeChanger: true }}
      />

      <Drawer
        title={editingProduct ? '编辑商品' : '新增商品'}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={620}
        extra={
          <Space>
            <Button onClick={() => setDrawerOpen(false)}>取消</Button>
            <Button type="primary" loading={saving} onClick={() => void handleSubmit()}>
              保存
            </Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="商品名称" rules={[{ required: true, message: '请输入商品名称' }]}>
            <Input placeholder="如：坝上莜面" maxLength={120} />
          </Form.Item>

          <Form.Item name="category" label="商品分类" rules={[{ required: true, message: '请选择分类' }]}>
            <Select options={MALL_CATEGORY_OPTIONS} />
          </Form.Item>

          <Space size="middle" style={{ display: 'flex' }} align="start">
            <Form.Item name="price" label="售价（元）" rules={[{ required: true, message: '请输入售价' }]}>
              <InputNumber min={0} precision={2} style={{ width: 160 }} />
            </Form.Item>
            <Form.Item name="originalPrice" label="划线价（元）">
              <InputNumber min={0} precision={2} style={{ width: 160 }} />
            </Form.Item>
            <Form.Item name="unit" label="单位">
              <Input placeholder="件 / 袋 / 盒" maxLength={20} style={{ width: 120 }} />
            </Form.Item>
          </Space>

          <Form.Item name="stock" label="库存" rules={[{ required: true, message: '请输入库存' }]}>
            <InputNumber min={0} precision={0} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item label="商品图片">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Form.Item name="image" noStyle>
                <Input placeholder="上传后自动填充，也可直接粘贴图片地址" maxLength={500} />
              </Form.Item>
              <Space>
                <Upload {...uploadProps}>
                  <Button icon={<UploadOutlined />} loading={uploading}>
                    上传图片
                  </Button>
                </Upload>
                <Form.Item noStyle shouldUpdate={(prev, next) => prev.image !== next.image}>
                  {({ getFieldValue }) =>
                    getFieldValue('image') ? (
                      <Image src={getFieldValue('image')} width={72} height={72} style={{ objectFit: 'cover', borderRadius: 6 }} />
                    ) : null
                  }
                </Form.Item>
              </Space>
            </Space>
          </Form.Item>

          <Form.Item name="summary" label="一句话简介">
            <Input placeholder="展示在商品卡片上的副标题" maxLength={255} />
          </Form.Item>

          <Form.Item name="description" label="商品详情">
            <Input.TextArea rows={5} placeholder="产地、工艺、食用或使用说明" />
          </Form.Item>

          <Form.Item name="tags" label="标签（英文逗号分隔）">
            <Input placeholder="如：莜面,坝上,粗粮" maxLength={255} />
          </Form.Item>

          <Form.Item name="sortOrder" label="排序">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="enabled" label="上架" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Drawer>
    </Card>
  )
}

export default function MallProductManagementPage() {
  return <MallProductManagementPageInner />
}
