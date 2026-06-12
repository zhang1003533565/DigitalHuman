import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Button,
  Form,
  Input,
  Spin,
  Typography,
  message,
} from 'antd'
import {
  CheckCircleFilled,
  EyeInvisibleOutlined,
  EyeOutlined,
  ExperimentOutlined,
  RobotOutlined,
  SettingOutlined,
  UserOutlined,
} from '@ant-design/icons'
import {
  addModelOption,
  getProviderConfigs,
  saveProviderConfig,
  selectModelOption,
  testGuideChat,
  type GuideChatTestResponse,
  type ProviderConfig,
} from '../api/aiModelConfig'

const { Title, Text, Paragraph } = Typography

const DEFAULT_PROVIDER = 'DeepSeek'
const DEFAULT_BASE_URL = 'https://api.deepseek.com/v1'
const DEFAULT_MODEL_ID = 'deepseek-chat'
const DEFAULT_API_KEY_PLACEHOLDER = 'sk-请替换为你的API密钥'

const AI_PAGE_STYLES = `
  .ai-page { display: grid; gap: 18px; min-height: 100%; color: #1f2a44; }
  .ai-page__header { display: grid; gap: 6px; }
  .ai-page__title { margin: 0 !important; color: #17305a !important; font-size: 34px !important; font-weight: 700 !important; letter-spacing: -0.03em; }
  .ai-page__subtitle { color: #5e7296; font-size: 14px; }
  .ai-page__grid { display: grid; grid-template-columns: minmax(360px, 440px) minmax(0, 1fr); gap: 18px; min-height: 0; }
  .ai-card { border: 1px solid #e8eef8; border-radius: 22px; background: linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,251,255,0.94)); box-shadow: 0 18px 48px rgba(30,64,141,0.08); overflow: hidden; }
  .ai-card__inner { display: grid; gap: 20px; padding: 22px; min-height: 0; }
  .ai-card--fill { height: 100%; display: flex; flex-direction: column; }
  .ai-card--fill > .ai-card__inner { display: flex; flex-direction: column; flex: 1; }
  .ai-card__header { display: flex; align-items: flex-start; gap: 12px; }
  .ai-card__icon { width: 40px; height: 40px; border-radius: 14px; display: grid; place-items: center; background: linear-gradient(180deg, rgba(57,118,255,0.14), rgba(57,118,255,0.06)); color: #2468ff; font-size: 20px; flex: none; }
  .ai-card__title { margin: 0 !important; color: #1f3054 !important; font-size: 22px !important; font-weight: 700 !important; }
  .ai-card__desc { color: #7184a5; font-size: 13px; }
  .ai-form { display: grid; gap: 18px; }
  .ai-form .ant-form-item { margin-bottom: 0; }
  .ai-form .ant-form-item-label > label { color: #20365f; font-weight: 600; }
  .ai-form .ant-input, .ai-form .ant-input-affix-wrapper, .ai-form .ant-select-selector { min-height: 44px !important; border-radius: 12px !important; border-color: #dce5f2 !important; box-shadow: none !important; }
  .ai-form .ant-input:focus, .ai-form .ant-input-affix-wrapper-focused, .ai-form .ant-select-focused .ant-select-selector { border-color: #2f6dff !important; }
  .ai-fixed-field { display: flex; align-items: center; min-height: 44px; padding: 8px 12px; border-radius: 12px; border: 1px solid #dce5f2; background: #f7faff; color: #20365f; font-size: 14px; }
  .ai-save-btn.ant-btn-primary, .ai-send-btn.ant-btn-primary { height: 46px; border: none; border-radius: 14px; background: linear-gradient(135deg, #2f6dff, #1458ff); box-shadow: 0 14px 28px rgba(47,109,255,0.22); font-weight: 600; }
  .ai-save-btn.ant-btn-primary:hover, .ai-send-btn.ant-btn-primary:hover, .ai-save-btn.ant-btn-primary:focus, .ai-send-btn.ant-btn-primary:focus { background: linear-gradient(135deg, #2459d4, #0f49d8) !important; }
  .ai-save-btn { width: 136px; }
  .ai-note { display: grid; gap: 10px; padding: 18px; border-radius: 18px; border: 1px solid #e3ebf7; background: linear-gradient(180deg, rgba(244,248,255,0.92), rgba(250,252,255,0.9)); }
  .ai-note__title { display: inline-flex; align-items: center; gap: 8px; color: #2564ff; font-weight: 700; }
  .ai-note ul { margin: 0; padding-left: 20px; color: #5e7296; }
  .ai-note li + li { margin-top: 6px; }
  .ai-test-panel { display: flex; flex-direction: column; gap: 18px; min-height: 0; flex: 1; overflow: hidden; }
  .ai-current { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-bottom: 16px; border-bottom: 1px solid #edf2fa; }
  .ai-current__meta { display: grid; gap: 8px; }
  .ai-current__label { color: #4f6488; font-size: 13px; font-weight: 600; }
  .ai-current__badge { display: inline-flex; align-items: center; gap: 8px; width: fit-content; padding: 8px 12px; border-radius: 999px; background: #f2f6ff; color: #415a84; font-size: 13px; }
  .ai-current__status { display: inline-flex; align-items: center; gap: 8px; padding: 8px 14px; border-radius: 999px; background: #ebfbef; color: #18a957; font-size: 13px; font-weight: 700; }
  .ai-current__status--idle { background: #f3f6fb; color: #6b7f9f; }
  .ai-chat { display: flex; flex-direction: column; gap: 12px; min-height: 0; flex: 1; overflow: hidden; }
  .ai-chat__scroll { display: flex; flex-direction: column; gap: 14px; flex: 0 1 360px; max-height: min(360px, 42vh); overflow-y: auto; overflow-x: hidden; padding: 2px 4px 2px 0; }
  .ai-message { display: flex; align-items: flex-start; gap: 10px; width: fit-content; max-width: min(58%, 520px); }
  .ai-message--assistant { align-self: flex-start; }
  .ai-message--user { align-self: flex-end; flex-direction: row-reverse; }
  .ai-message__avatar { width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; flex: 0 0 34px; margin-top: 2px; background: linear-gradient(135deg, #2f6dff, #4b8dff); color: #fff; font-size: 16px; box-shadow: 0 8px 18px rgba(47,109,255,0.18); }
  .ai-message--assistant .ai-message__avatar { background: linear-gradient(135deg, #8c72ff, #6d8cff); box-shadow: 0 8px 18px rgba(109,140,255,0.18); }
  .ai-message__body { display: grid; gap: 5px; min-width: 0; }
  .ai-message--user .ai-message__body { justify-items: end; }
  .ai-message__author { color: #1f3054; font-size: 13px; font-weight: 700; line-height: 1.2; }
  .ai-message__time { color: #90a0bb; font-size: 12px; line-height: 1.2; }
  .ai-bubble { display: grid; gap: 10px; min-width: 0; max-width: 100%; width: fit-content; padding: 14px 16px; border-radius: 16px; background: #eef5ff; border: 1px solid #dfe9f8; }
  .ai-message--assistant .ai-bubble { background: linear-gradient(180deg, #ffffff, #f7faff); }
  .ai-message--user .ai-bubble { background: linear-gradient(180deg, #eff6ff, #eaf3ff); border-color: #dbe8fb; }
  .ai-bubble__content { color: #44597f; line-height: 1.75; white-space: pre-wrap; overflow-wrap: anywhere; }
  .ai-input-wrap { display: grid; grid-template-columns: minmax(0, 1fr) 116px; gap: 14px; align-items: end; }
  .ai-input-wrap .ant-input { border-radius: 16px !important; border-color: #dce5f2 !important; min-height: 38px !important; resize: none; padding: 8px 12px !important; line-height: 22px; }
  .ai-metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; padding: 10px 14px; border-radius: 14px; border: 1px solid #e0f1e8; background: linear-gradient(180deg, rgba(241,253,246,0.96), rgba(249,255,251,0.96)); }
  .ai-metrics__item { display: grid; gap: 4px; }
  .ai-metrics__label { color: #6a7f9d; font-size: 11px; }
  .ai-metrics__value { color: #1f3054; font-size: 18px; font-weight: 700; line-height: 1.2; }
  .ai-metrics__value--success { color: #1ca85b; }
  .ai-metrics__value--danger { color: #e24c4c; }
  .ai-empty-tip { padding: 16px; border-radius: 16px; border: 1px dashed #d6e2f3; background: #f9fbff; color: #7a8eae; text-align: center; }
  @media (max-width: 1180px) { .ai-page__grid { grid-template-columns: 1fr; } }
  @media (max-width: 760px) { .ai-input-wrap, .ai-metrics { grid-template-columns: 1fr; } .ai-save-btn, .ai-send-btn { width: 100%; } .ai-chat__scroll { max-height: 42vh; } .ai-message { max-width: 92%; } .ai-bubble { min-width: 0; } }
`

type AiConfigFormValues = {
  apiKey: string
}

type ChatMessage = { id: string; role: 'user' | 'assistant'; content: string; time: string }
type TestMetrics = { success: boolean; latencyMs: number; tokenUsage: number; testedAt: string }

function nowTimeLabel() {
  return new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
}
function nowDateTimeLabel() {
  return new Date().toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
}
function estimateTokenUsage(input: string, output: string) {
  return Math.max(1, Math.round((input.length + output.length) / 2))
}
function resolveAssistantText(result: GuideChatTestResponse) {
  return result.answerText || '游客端智能体已返回响应，但没有可展示的文本内容。'
}

/** 给 Promise 加绝对超时，防止请求永久挂起 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ])
}

export default function AiModelManagementPage() {
  const [form] = Form.useForm<AiConfigFormValues>()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [testInput, setTestInput] = useState('你好')
  const [testMetrics, setTestMetrics] = useState<TestMetrics | null>(null)
  const [guideTestSessionId, setGuideTestSessionId] = useState('')
  const [hasValidConfig, setHasValidConfig] = useState(false)
  const loadingRef = useRef<number>(0)
  const chatScrollRef = useRef<HTMLDivElement | null>(null)
  const pendingScrollRef = useRef<{ id: string; align: 'top' | 'bottom' } | null>(null)

  const currentModelLabel = useMemo(() => `${DEFAULT_PROVIDER} / ${DEFAULT_MODEL_ID}`, [])

  useEffect(() => {
    const gen = ++loadingRef.current
    let cancelled = false

    async function load() {
      setLoading(true)
      form.setFieldsValue({
        apiKey: DEFAULT_API_KEY_PLACEHOLDER,
      })

      try {
        const providers = await withTimeout(getProviderConfigs(), 6000)
        if (cancelled || gen !== loadingRef.current) return

        const matched: ProviderConfig | undefined = providers.find(
          (p: ProviderConfig) => p.provider.toLowerCase() === DEFAULT_PROVIDER.toLowerCase(),
        )

        form.setFieldsValue({
          apiKey: matched?.apiKey || DEFAULT_API_KEY_PLACEHOLDER,
        })
        setHasValidConfig(Boolean(matched?.apiKey))
      } catch {
        message.warning('配置加载超时，已使用默认模板。')
      } finally {
        if (gen === loadingRef.current) setLoading(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [form])

  useEffect(() => {
    const pending = pendingScrollRef.current
    const container = chatScrollRef.current
    if (!pending || !container) return

    const target = container.querySelector<HTMLElement>(`[data-message-id="${pending.id}"]`)
    if (!target) return

    const top = pending.align === 'bottom'
      ? target.offsetTop + target.offsetHeight - container.clientHeight
      : target.offsetTop - container.offsetTop

    container.scrollTo({
      top: Math.max(0, top),
      behavior: 'smooth',
    })
    pendingScrollRef.current = null
  }, [messages, testMetrics])

  async function persistConfig(options?: { silent?: boolean }) {
    const values = await form.validateFields()
    const provider = DEFAULT_PROVIDER
    const modelId = DEFAULT_MODEL_ID

    await saveProviderConfig({ provider, baseUrl: DEFAULT_BASE_URL, apiKey: values.apiKey, protocol: 'openai_compatible' })

    const option = { category: 'chat', provider, modelId }
    try { await addModelOption(option) } catch { /* 可能已存在 */ }
    await selectModelOption(option)
    setHasValidConfig(true)

    if (!options?.silent) message.success('配置已保存')
    return { provider, modelId }
  }

  async function handleSave() {
    try { setSaving(true); await persistConfig() }
    catch { message.error('保存失败，请检查服务配置后重试。') }
    finally { setSaving(false) }
  }

  async function handleSendTest() {
    const question = testInput.trim()
    if (!question) { message.warning('请输入测试问题后再发送。'); return }

    try {
      setTesting(true)
      await persistConfig({ silent: true })

      const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: 'user', content: question, time: nowTimeLabel() }
      pendingScrollRef.current = { id: userMsg.id, align: 'top' }
      setMessages((c) => [...c, userMsg])

      const startedAt = performance.now()
      const result = await withTimeout(testGuideChat({ sessionId: guideTestSessionId || undefined, question }), 25000)
      const latencyMs = Math.max(1, Math.round(performance.now() - startedAt))
      const answer = resolveAssistantText(result)
      setGuideTestSessionId(result.sessionId || guideTestSessionId)

      const asstMsg: ChatMessage = { id: `a-${Date.now()}`, role: 'assistant', content: answer, time: nowTimeLabel() }
      pendingScrollRef.current = { id: asstMsg.id, align: 'bottom' }
      setMessages((c) => [...c, asstMsg])
      setTestMetrics({ success: true, latencyMs, tokenUsage: estimateTokenUsage(question, answer), testedAt: nowDateTimeLabel() })
      message.success('游客端智能体测试成功')
    } catch {
      const fail = '游客端智能体测试失败，请检查游客端对话服务、模型配置与接口凭证。'
      const failMsg: ChatMessage = { id: `a-${Date.now()}`, role: 'assistant', content: fail, time: nowTimeLabel() }
      pendingScrollRef.current = { id: failMsg.id, align: 'bottom' }
      setMessages((c) => [...c, failMsg])
      setTestMetrics({ success: false, latencyMs: 0, tokenUsage: 0, testedAt: nowDateTimeLabel() })
      message.error(fail)
    } finally { setTesting(false) }
  }

  return (
    <div className="ai-page">
      <style>{AI_PAGE_STYLES}</style>

      <div className="ai-page__header">
        <Title level={2} className="ai-page__title">AI模型管理</Title>
        <Text className="ai-page__subtitle">配置和管理用于智能对话服务的 AI 模型，并可进行模型测试验证。</Text>
      </div>

      <Spin spinning={loading}>
        <div className="ai-page__grid">
          {/* -------- 左侧：模型配置 -------- */}
          <section className="ai-card">
            <div className="ai-card__inner">
              <div className="ai-card__header">
                <div className="ai-card__icon"><SettingOutlined /></div>
                <div>
                  <Title level={3} className="ai-card__title">模型配置</Title>
                  <div className="ai-card__desc">配置 AI 模型的连接信息</div>
                </div>
              </div>

              <Form<AiConfigFormValues> form={form} layout="vertical" className="ai-form"
                initialValues={{ apiKey: DEFAULT_API_KEY_PLACEHOLDER }}>

                <Form.Item label="服务商">
                  <div className="ai-fixed-field">{DEFAULT_PROVIDER}</div>
                </Form.Item>

                <Form.Item label="模型名称">
                  <div className="ai-fixed-field">{DEFAULT_MODEL_ID}</div>
                </Form.Item>

                <Form.Item label="API 地址">
                  <div className="ai-fixed-field">{DEFAULT_BASE_URL}</div>
                </Form.Item>

                <Form.Item label="API Key" name="apiKey" rules={[{ required: true, message: '请输入 API Key' }]}>
                  <Input
                    type={showKey ? 'text' : 'password'}
                    placeholder="例如：sk-xxxxxxxxxxxxxxxxxxxxxxxx"
                    suffix={showKey ? <EyeOutlined onClick={() => setShowKey(false)} /> : <EyeInvisibleOutlined onClick={() => setShowKey(true)} />}
                    onFocus={(e) => { (e.target as HTMLInputElement).select?.() }}
                  />
                </Form.Item>

                <Button type="primary" className="ai-save-btn" loading={saving} onClick={handleSave}>
                  保存配置
                </Button>
              </Form>

              <div className="ai-note">
                <div className="ai-note__title"><CheckCircleFilled /><span>说明</span></div>
                <ul>
                  <li>当前配置将用于系统对话模型保存与后续测试。</li>
                  <li>请确保 API Key 有效，且账号具备对应模型调用额度。</li>
                  <li>模型测试会先同步保存当前配置，再发起真实接口调用。</li>
                </ul>
              </div>
            </div>
          </section>

          {/* -------- 右侧：模型测试 -------- */}
          <section className="ai-card ai-card--fill">
            <div className="ai-card__inner ai-test-panel">
              <div className="ai-card__header">
                <div className="ai-card__icon"><ExperimentOutlined /></div>
                <div>
                  <Title level={3} className="ai-card__title">模型测试</Title>
                  <div className="ai-card__desc">测试模型是否可以正常响应</div>
                </div>
              </div>

              <div className="ai-current">
                <div className="ai-current__meta">
                  <span className="ai-current__label">当前模型</span>
                  <span className="ai-current__badge">{currentModelLabel}</span>
                </div>
                <span className={`ai-current__status${hasValidConfig ? '' : ' ai-current__status--idle'}`}>
                  <CheckCircleFilled />{hasValidConfig ? '已连接' : '待配置'}
                </span>
              </div>

              <div className="ai-chat">
                <div className="ai-chat__scroll" ref={chatScrollRef}>
                  {messages.map((m) => (
                    <div key={m.id} data-message-id={m.id} className={`ai-message ai-message--${m.role === 'assistant' ? 'assistant' : 'user'}`}>
                      <span className="ai-message__avatar">{m.role === 'assistant' ? <RobotOutlined /> : <UserOutlined />}</span>
                      <div className="ai-message__body">
                        <span className="ai-message__author">{m.role === 'assistant' ? 'AI' : '用户'}</span>
                        <div className="ai-bubble">
                          <div className="ai-bubble__content">{m.content}</div>
                        </div>
                        <span className="ai-message__time">{m.time}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {testMetrics ? (
                  <div className="ai-metrics">
                    <div className="ai-metrics__item">
                      <span className="ai-metrics__label">响应状态</span>
                      <span className={`ai-metrics__value${testMetrics.success ? ' ai-metrics__value--success' : ' ai-metrics__value--danger'}`}>
                        {testMetrics.success ? '成功' : '失败'}
                      </span>
                    </div>
                    <div className="ai-metrics__item">
                      <span className="ai-metrics__label">响应时间</span>
                      <span className="ai-metrics__value">{testMetrics.success ? `${(testMetrics.latencyMs / 1000).toFixed(2)}s` : '--'}</span>
                    </div>
                    <div className="ai-metrics__item">
                      <span className="ai-metrics__label">Token 使用</span>
                      <span className="ai-metrics__value">{testMetrics.success ? testMetrics.tokenUsage : '--'}</span>
                    </div>
                    <div className="ai-metrics__item">
                      <span className="ai-metrics__label">测试时间</span>
                      <span className="ai-metrics__value" style={{ fontSize: 13 }}>{testMetrics.testedAt}</span>
                    </div>
                  </div>
                ) : (
                  <div className="ai-empty-tip">
                    <Paragraph style={{ marginBottom: 0 }}>保存配置后可直接在这里发起测试，对话结果会展示在上方消息区。</Paragraph>
                  </div>
                )}
              </div>

              <div className="ai-input-wrap">
                <div>
                  <Input.TextArea
                    value={testInput}
                    onChange={(e) => setTestInput(e.target.value)}
                    placeholder="请输入测试问题..."
                    autoSize={{ minRows: 1, maxRows: 4 }}
                  />
                </div>
                <Button type="primary" className="ai-send-btn" loading={testing} onClick={handleSendTest}>
                  发送
                </Button>
              </div>
            </div>
          </section>
        </div>
      </Spin>
    </div>
  )
}
