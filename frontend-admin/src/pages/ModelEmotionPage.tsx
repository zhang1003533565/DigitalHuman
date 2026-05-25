import { type Key, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Typography,
  message,
} from 'antd';
import type { TableProps } from 'antd';
import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import {
  type ActionTriggerRule,
  type ActionTriggerConfig,
  type DigitalHumanModel,
  type ModelAction,
  modelEmotionApi,
} from '../api/modelEmotionApi';
import { useDeferredMount } from '../hooks/useDeferredMount';

function getModelDisplayName(model?: Pick<DigitalHumanModel, 'modelKey' | 'displayName'> | null) {
  if (!model) {
    return 'DH';
  }

  return model.displayName || model.modelKey;
}

const MOUSE_EVENTS = [
  { value: 'CLICK_LEFT', label: '点击（左键）' },
  { value: 'DOUBLE_CLICK_LEFT', label: '双击（左键）' },
  { value: 'RIGHT_CLICK', label: '右键点击' },
  { value: 'SLIDE_LEFT', label: '滑动（向左）' },
  { value: 'SLIDE_RIGHT', label: '滑动（向右）' },
  { value: 'WHEEL_UP', label: '滚轮向上' },
];

type RuleFormValue = {
  eventCode?: string;
  phrasesText?: string;
  actionId: number;
  enabled: boolean;
  priority: number;
};

type EditingState = {
  mode: 'mouse' | 'text';
  index?: number;
  initial?: ActionTriggerRule;
};

function splitPhrases(value?: string) {
  return (value ?? '')
    .split(/[,\n，、]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinPhrases(phrases?: string[]) {
  return (phrases ?? []).join('，');
}

function getActionLabel(action?: Pick<ModelAction, 'actionName' | 'motionFilePath'>) {
  if (!action) {
    return '-';
  }
  return action.actionName || action.motionFilePath;
}

function mergeRuleAction(rule: ActionTriggerRule, actions: ModelAction[]): ActionTriggerRule {
  const action = actions.find((item) => item.id === rule.actionId);
  if (!action) {
    return rule;
  }
  return {
    ...rule,
    actionName: action.actionName,
    motionFilePath: action.motionFilePath,
    groupName: action.groupName,
    actionIndex: action.actionIndex,
  };
}

function normalizePriority(priority?: number) {
  if (priority === undefined || priority === null) {
    return 1;
  }
  return Math.max(1, Math.min(10, priority));
}

function getRuleRowKey(mode: 'mouse' | 'text', rule: ActionTriggerRule) {
  if (rule.id) {
    return `${mode}-${rule.id}`;
  }
  const phraseKey = joinPhrases(rule.phrases);
  return `${mode}-draft-${rule.eventCode || phraseKey}-${rule.actionId}-${rule.priority}-${rule.enabled}`;
}

export default function ModelEmotionPage() {
  const [models, setModels] = useState<DigitalHumanModel[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<number | null>(null);
  const [config, setConfig] = useState<ActionTriggerConfig | null>(null);
  const [activeMode, setActiveMode] = useState<'mouse' | 'text'>('mouse');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [selectedMouseRuleKeys, setSelectedMouseRuleKeys] = useState<Key[]>([]);
  const [selectedTextRuleKeys, setSelectedTextRuleKeys] = useState<Key[]>([]);
  const [form] = Form.useForm<RuleFormValue>();

  const actionOptions = useMemo(
    () => (config?.actions ?? []).map((action) => ({
      value: action.id,
      label: `${action.actionName || action.actionKey} / ${action.motionFilePath}`,
    })),
    [config?.actions],
  );

  const selectedModel = models.find((model) => model.id === selectedModelId) ?? config?.model;

  async function loadModels(autoScan = false) {
    setLoading(true);
    try {
      const data = autoScan ? await modelEmotionApi.scanModels() : await modelEmotionApi.getModels();
      setModels(data);
      const nextModelId = selectedModelId && data.some((model) => model.id === selectedModelId)
        ? selectedModelId
        : data[0]?.id ?? null;
      setSelectedModelId(nextModelId);
      if (nextModelId) {
        await loadTriggerConfig(nextModelId);
      } else {
        setConfig(null);
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : '加载模型失败');
    } finally {
      setLoading(false);
    }
  }

  async function loadTriggerConfig(modelId: number) {
    setLoading(true);
    try {
      setConfig(await modelEmotionApi.getTriggerConfig(modelId));
      setSelectedMouseRuleKeys([]);
      setSelectedTextRuleKeys([]);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '加载动作配置失败');
      setConfig(null);
    } finally {
      setLoading(false);
    }
  }

  useDeferredMount(() => {
    void loadModels(true);
  });

  async function handleModelChange(modelId: number) {
    setSelectedModelId(modelId);
    await loadTriggerConfig(modelId);
  }

  function openRuleModal(mode: 'mouse' | 'text', index?: number) {
    const source = mode === 'mouse' ? config?.mouseRules : config?.textRules;
    const initial = index === undefined ? undefined : source?.[index];
    setEditing({ mode, index, initial });
    form.setFieldsValue({
      eventCode: initial?.eventCode || 'CLICK_LEFT',
      phrasesText: joinPhrases(initial?.phrases),
      actionId: initial?.actionId,
      enabled: initial?.enabled ?? true,
      priority: normalizePriority(initial?.priority),
    });
  }

  function closeRuleModal() {
    setEditing(null);
    form.resetFields();
  }

  async function saveRuleModal() {
    if (!config || !editing) {
      return;
    }
    const values = await form.validateFields();
    const rule: ActionTriggerRule = mergeRuleAction({
      ...editing.initial,
      ruleType: editing.mode === 'mouse' ? 'MOUSE' : 'KEYWORD',
      eventCode: editing.mode === 'mouse' ? values.eventCode : '',
      phrases: editing.mode === 'mouse' ? [] : splitPhrases(values.phrasesText),
      actionId: values.actionId,
      enabled: values.enabled,
      priority: normalizePriority(values.priority),
    }, config.actions);

    const patchRules = (rules: ActionTriggerRule[]) => {
      if (editing.index === undefined) {
        return [...rules, rule];
      }
      return rules.map((item, index) => (index === editing.index ? rule : item));
    };

    const nextConfig = {
      ...config,
      mouseRules: editing.mode === 'mouse' ? patchRules(config.mouseRules) : config.mouseRules,
      textRules: editing.mode === 'text' ? patchRules(config.textRules) : config.textRules,
    };
    const saved = await saveConfig(nextConfig, '动作配置已保存');
    if (saved) {
      closeRuleModal();
    }
  }

  async function removeRule(mode: 'mouse' | 'text', index: number) {
    if (!config) {
      return;
    }
    const nextConfig = {
      ...config,
      mouseRules: mode === 'mouse' ? config.mouseRules.filter((_, itemIndex) => itemIndex !== index) : config.mouseRules,
      textRules: mode === 'text' ? config.textRules.filter((_, itemIndex) => itemIndex !== index) : config.textRules,
    };
    await saveConfig(nextConfig, '已删除并保存');
  }

  async function removeSelectedRules(mode: 'mouse' | 'text') {
    if (!config) {
      return;
    }
    const selectedKeys = mode === 'mouse' ? selectedMouseRuleKeys : selectedTextRuleKeys;
    if (!selectedKeys.length) {
      return;
    }
    const selectedKeySet = new Set(selectedKeys);
    const nextConfig = {
      ...config,
      mouseRules: mode === 'mouse'
        ? config.mouseRules.filter((rule) => !selectedKeySet.has(getRuleRowKey('mouse', rule)))
        : config.mouseRules,
      textRules: mode === 'text'
        ? config.textRules.filter((rule) => !selectedKeySet.has(getRuleRowKey('text', rule)))
        : config.textRules,
    };
    const saved = await saveConfig(nextConfig, '已批量删除并保存');
    if (saved) {
      if (mode === 'mouse') {
        setSelectedMouseRuleKeys([]);
      } else {
        setSelectedTextRuleKeys([]);
      }
    }
  }

  async function toggleRule(mode: 'mouse' | 'text', index: number, enabled: boolean) {
    if (!config) {
      return;
    }
    const patch = (rules: ActionTriggerRule[]) => rules.map((rule, itemIndex) => (
      itemIndex === index ? { ...rule, enabled } : rule
    ));
    const nextConfig = {
      ...config,
      mouseRules: mode === 'mouse' ? patch(config.mouseRules) : config.mouseRules,
      textRules: mode === 'text' ? patch(config.textRules) : config.textRules,
    };
    await saveConfig(nextConfig, enabled ? '已启用并保存' : '已停用并保存');
  }

  async function saveConfig(configToSave = config, successMessage = '动作配置已保存') {
    if (!configToSave || !selectedModelId) {
      return false;
    }
    setSaving(true);
    try {
      const saved = await modelEmotionApi.saveTriggerConfig(selectedModelId, {
        mouseRules: configToSave.mouseRules.map((rule) => mergeRuleAction(rule, configToSave.actions)),
        textRules: configToSave.textRules.map((rule) => mergeRuleAction(rule, configToSave.actions)),
      });
      setConfig(saved);
      message.success(successMessage);
      return true;
    } catch (error) {
      message.error(error instanceof Error ? error.message : '保存配置失败');
      return false;
    } finally {
      setSaving(false);
    }
  }

  const mouseColumns: TableProps<ActionTriggerRule>['columns'] = [
    {
      title: '触发事件',
      dataIndex: 'eventCode',
      render: (value: string) => MOUSE_EVENTS.find((event) => event.value === value)?.label ?? value,
    },
    {
      title: '动作名称',
      render: (_, row) => row.actionName || getActionLabel(config?.actions.find((action) => action.id === row.actionId)),
    },
    { title: '动作文件', dataIndex: 'motionFilePath', ellipsis: true },
    { title: '优先级', dataIndex: 'priority', width: 90, render: (value: number) => normalizePriority(value) },
    {
      title: '启用',
      dataIndex: 'enabled',
      width: 90,
      render: (enabled: boolean, _row, index) => (
        <Switch checked={enabled} size="small" loading={saving} onChange={(checked) => void toggleRule('mouse', index, checked)} />
      ),
    },
    {
      title: '操作',
      width: 120,
      render: (_, _row, index) => (
        <Space>
          <Button aria-label="编辑" icon={<EditOutlined />} type="text" onClick={() => openRuleModal('mouse', index)} />
          <Button aria-label="删除" icon={<DeleteOutlined />} type="text" danger loading={saving} onClick={() => void removeRule('mouse', index)} />
        </Space>
      ),
    },
  ];

  const textColumns: TableProps<ActionTriggerRule>['columns'] = [
    {
      title: '关键词',
      dataIndex: 'phrases',
      render: (phrases: string[]) => joinPhrases(phrases),
    },
    {
      title: '动作名称',
      render: (_, row) => row.actionName || getActionLabel(config?.actions.find((action) => action.id === row.actionId)),
    },
    { title: '动作文件', dataIndex: 'motionFilePath', ellipsis: true },
    { title: '优先级', dataIndex: 'priority', width: 90, render: (value: number) => normalizePriority(value) },
    {
      title: '启用',
      dataIndex: 'enabled',
      width: 90,
      render: (enabled: boolean, _row, index) => (
        <Switch checked={enabled} size="small" loading={saving} onChange={(checked) => void toggleRule('text', index, checked)} />
      ),
    },
    {
      title: '操作',
      width: 120,
      render: (_, _row, index) => (
        <Space>
          <Button aria-label="编辑" icon={<EditOutlined />} type="text" onClick={() => openRuleModal('text', index)} />
          <Button aria-label="删除" icon={<DeleteOutlined />} type="text" danger loading={saving} onClick={() => void removeRule('text', index)} />
        </Space>
      ),
    },
  ];

  return (
    <div className="model-action-page">
      <aside className="model-action-side">
        <Card title="选择人物" className="model-action-card">
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Select
              value={selectedModelId}
              loading={loading}
              placeholder="选择数字人模型"
              style={{ width: '100%' }}
              options={models.map((model) => ({ value: model.id, label: getModelDisplayName(model) }))}
              onChange={(value) => void handleModelChange(value)}
            />
            <div className="model-action-avatar" aria-hidden>
              {getModelDisplayName(selectedModel).slice(0, 2).toUpperCase()}
            </div>
            <Button icon={<ReloadOutlined />} block onClick={() => void loadModels(true)} loading={loading}>
              替换/扫描模型
            </Button>
          </Space>
        </Card>

        <Card title="模型信息" className="model-action-card">
          <dl className="model-action-meta">
            <dt>模型 ID</dt>
            <dd>{selectedModel?.modelKey ?? '-'}</dd>
            <dt>模型文件</dt>
            <dd>{selectedModel?.modelPath ?? '-'}</dd>
            <dt>动作数量</dt>
            <dd>{config?.actions.length ?? 0}</dd>
            <dt>更新时间</dt>
            <dd>{selectedModel?.updatedAt ? new Date(selectedModel.updatedAt).toLocaleString('zh-CN') : '-'}</dd>
          </dl>
        </Card>
      </aside>

      <main className="model-action-main">
        <Card className="model-action-card model-action-mode-card">
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <button
                type="button"
                className={activeMode === 'mouse' ? 'model-action-mode is-active' : 'model-action-mode'}
                onClick={() => setActiveMode('mouse')}
              >
                <strong>鼠标触发</strong>
                <span>通过点击、滑动、滚轮等交互触发动作</span>
              </button>
            </Col>
            <Col xs={24} md={12}>
              <button
                type="button"
                className={activeMode === 'text' ? 'model-action-mode is-active' : 'model-action-mode'}
                onClick={() => setActiveMode('text')}
              >
                <strong>关键词触发</strong>
                <span>通过用户输入、回答文本中的词语触发动作</span>
              </button>
            </Col>
          </Row>
        </Card>

        {!config ? (
          <Card>
            <Empty description="暂无模型，请先扫描 Live2D 模型目录" />
          </Card>
        ) : activeMode === 'mouse' ? (
          <Card
            title="鼠标触发配置"
            extra={(
              <Space>
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  disabled={!selectedMouseRuleKeys.length}
                  loading={saving}
                  onClick={() => void removeSelectedRules('mouse')}
                >
                  批量删除
                </Button>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => openRuleModal('mouse')}>新增触发</Button>
              </Space>
            )}
          >
            <Table
              rowKey={(row) => getRuleRowKey('mouse', row)}
              rowSelection={{
                selectedRowKeys: selectedMouseRuleKeys,
                onChange: (keys) => setSelectedMouseRuleKeys(keys),
              }}
              columns={mouseColumns}
              dataSource={config.mouseRules}
              loading={loading}
              pagination={{ pageSize: 10 }}
              size="middle"
            />
          </Card>
        ) : (
          <Card
            title="关键词触发配置"
            extra={(
              <Space>
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  disabled={!selectedTextRuleKeys.length}
                  loading={saving}
                  onClick={() => void removeSelectedRules('text')}
                >
                  批量删除
                </Button>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => openRuleModal('text')}>新增触发</Button>
              </Space>
            )}
          >
            <Table
              rowKey={(row) => getRuleRowKey('text', row)}
              rowSelection={{
                selectedRowKeys: selectedTextRuleKeys,
                onChange: (keys) => setSelectedTextRuleKeys(keys),
              }}
              columns={textColumns}
              dataSource={config.textRules}
              loading={loading}
              pagination={{ pageSize: 10 }}
              size="middle"
            />
          </Card>
        )}

        <div className="model-action-footer">
          <Typography.Text type="secondary">新增、编辑、删除和启用状态会自动保存。</Typography.Text>
          <Button onClick={() => selectedModelId && void loadTriggerConfig(selectedModelId)}>取消</Button>
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={() => void saveConfig()}>
            手动保存
          </Button>
        </div>
      </main>

      <Modal
        title={editing?.mode === 'mouse' ? '配置鼠标触发' : '配置关键词触发'}
        open={Boolean(editing)}
        onCancel={closeRuleModal}
        onOk={() => void saveRuleModal()}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          {editing?.mode !== 'text' ? (
            <Form.Item name="eventCode" label="触发事件" rules={[{ required: true }]}>
              <Select options={MOUSE_EVENTS} />
            </Form.Item>
          ) : null}

          {editing?.mode === 'text' ? (
            <Form.Item
              name="phrasesText"
              label="关键词"
              rules={[{ required: true, message: '请输入至少一个关键词' }]}
            >
              <Input.TextArea rows={3} placeholder="例如：你好，你好呀，谢谢你" />
            </Form.Item>
          ) : null}

          <Form.Item name="actionId" label="动作" rules={[{ required: true, message: '请选择动作' }]}>
            <Select showSearch optionFilterProp="label" options={actionOptions} />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="priority" label="优先级" rules={[{ required: true }]}>
                <InputNumber min={1} max={10} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="enabled" label="启用" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
          </Row>
          <Typography.Text type="secondary">
            1 为最高，10 为最低；命中多条规则时按优先级权重随机触发。
          </Typography.Text>
        </Form>
      </Modal>
    </div>
  );
}
