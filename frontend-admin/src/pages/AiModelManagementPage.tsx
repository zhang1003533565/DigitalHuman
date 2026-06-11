import { Card, Typography } from 'antd'
import { ApiOutlined } from '@ant-design/icons'

const { Title, Text } = Typography

export default function AiModelManagementPage() {
  return (
    <Card>
      <div style={{ textAlign: 'center', padding: '80px 24px' }}>
        <ApiOutlined style={{ fontSize: 48, color: '#1890ff', marginBottom: 16 }} />
        <Title level={3}>AI 模型管理</Title>
        <Text type="secondary">页面建设中，敬请期待。</Text>
      </div>
    </Card>
  )
}
