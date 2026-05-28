import { type Key, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  mode: TriggerMode;
  index?: number;
  initial?: ActionTriggerRule;
};

type TriggerMode = 'mouse' | 'text' | 'idle';

type Live2DModel = {
  width: number;
  height: number;
  x: number;
  y: number;
  dragging?: boolean;
  _pointerX?: number;
  _pointerY?: number;
  buttonMode: boolean;
  position: {
    x: number;
    y: number;
  };
  scale: {
    set: (value: number) => void;
  };
  on: (eventName: string, handler: (...args: unknown[]) => void) => void;
  motion: (name: string, index?: number, priority?: number) => void;
  stopMotions?: () => void;
  expression?: () => void;
};

type PixiApplication = {
  stage: {
    addChild: (model: Live2DModel) => void;
    removeChild: (model: Live2DModel) => void;
  };
  renderer?: {
    resize: (width: number, height: number) => void;
  };
  start: () => void;
  stop: () => void;
  destroy: (removeView?: boolean, options?: { children?: boolean }) => void;
};

type PixiGlobal = {
  Application: new (options: {
    view: HTMLCanvasElement;
    autoStart: boolean;
    width?: number;
    height?: number;
    backgroundAlpha?: number;
    backgroundColor?: number;
  }) => PixiApplication;
  live2d: {
    Live2DModel: {
      from: (modelUrl: string) => Promise<Live2DModel>;
    };
  };
};

type DragPointerEvent = {
  data: {
    global: {
      x: number;
      y: number;
    };
  };
};

declare global {
  interface Window {
    PIXI?: PixiGlobal;
  }
}

const LIVE2D_SCRIPTS = [
  '/live2d/js/live2dcubismcore.min.js',
  '/live2d/js/live2d.min.js',
  '/live2d/js/pixi.min.js',
  '/live2d/js/cubism4.min.js',
];

let live2dScriptsPromise: Promise<void> | null = null;

function splitPhrases(value?: string) {
  return (value ?? '')
    .split(/[,\n，、]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinPhrases(phrases?: string[]) {
  return (phrases ?? []).join('，');
}

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existingScript) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`加载脚本失败：${src}`));
    document.body.appendChild(script);
  });
}

function loadLive2dScripts() {
  if (!live2dScriptsPromise) {
    live2dScriptsPromise = LIVE2D_SCRIPTS.reduce(
      (promise, src) => promise.then(() => loadScript(src)),
      Promise.resolve(),
    );
  }
  return live2dScriptsPromise;
}

function makeDraggable(
  model: Live2DModel,
  options?: { onDragStart?: () => void; onDragEnd?: () => void },
) {
  model.buttonMode = true;

  model.on('pointerdown', (event) => {
    const pointerEvent = event as DragPointerEvent;
    model.dragging = true;
    model._pointerX = pointerEvent.data.global.x - model.x;
    model._pointerY = pointerEvent.data.global.y - model.y;
    options?.onDragStart?.();
  });

  model.on('pointermove', (event) => {
    if (!model.dragging) {
      return;
    }
    const pointerEvent = event as DragPointerEvent;
    model.position.x = pointerEvent.data.global.x - (model._pointerX ?? 0);
    model.position.y = pointerEvent.data.global.y - (model._pointerY ?? 0);
  });

  const endDrag = () => {
    model.dragging = false;
    options?.onDragEnd?.();
  };

  model.on('pointerupoutside', endDrag);
  model.on('pointerup', endDrag);
}

function getPreviewSize(frame: HTMLDivElement) {
  const rect = frame.getBoundingClientRect();
  return {
    width: Math.max(260, Math.round(rect.width)),
    height: Math.max(300, Math.round(rect.height)),
  };
}

function syncCanvasSize(canvas: HTMLCanvasElement, frame: HTMLDivElement, app?: PixiApplication | null) {
  const { width, height } = getPreviewSize(frame);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  canvas.width = width;
  canvas.height = height;
  app?.renderer?.resize(width, height);
  return { width, height };
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

function getTriggerWeight(rule: ActionTriggerRule) {
  return 11 - normalizePriority(rule.priority);
}

function selectWeightedRule(rules: ActionTriggerRule[]) {
  const totalWeight = rules.reduce((sum, rule) => sum + getTriggerWeight(rule), 0);
  let cursor = Math.random() * totalWeight;

  for (const rule of rules) {
    cursor -= getTriggerWeight(rule);
    if (cursor < 0) {
      return rule;
    }
  }

  return rules[rules.length - 1] ?? null;
}

function getRuleRowKey(mode: TriggerMode, rule: ActionTriggerRule) {
  if (rule.id) {
    return `${mode}-${rule.id}`;
  }
  const phraseKey = joinPhrases(rule.phrases);
  return `${mode}-draft-${rule.eventCode || phraseKey}-${rule.actionId}-${rule.priority}-${rule.enabled}`;
}

function ModelActionPreview({
  model,
  config,
}: {
  model?: DigitalHumanModel | null;
  config: ActionTriggerConfig | null;
}) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const appRef = useRef<PixiApplication | null>(null);
  const modelRef = useRef<Live2DModel | null>(null);
  const loadIdRef = useRef(0);
  const dragStartXRef = useRef(0);
  const clickTimerRef = useRef<number | null>(null);
  const layoutModelRef = useRef<(() => void) | null>(null);
  const [status, setStatus] = useState('等待模型');

  const modelUrl = model?.modelPath ? `/live2d/${model.modelPath}` : '';

  const clearClickTimer = useCallback(() => {
    if (clickTimerRef.current !== null) {
      window.clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
  }, []);

  const playRule = useCallback((rule?: ActionTriggerRule | null) => {
    const live2dModel = modelRef.current;
    if (!live2dModel || !rule || rule.actionIndex === undefined || rule.actionIndex === null) {
      return false;
    }

    try {
      live2dModel.stopMotions?.();
      live2dModel.motion(rule.groupName ?? '', rule.actionIndex, 3);
      setStatus(`已触发：${rule.actionName || rule.motionFilePath || rule.eventCode || '动作'}`);
      return true;
    } catch (error) {
      console.warn('Admin action preview failed', rule, error);
      setStatus('动作播放失败');
      return false;
    }
  }, []);

  const triggerConfiguredAction = useCallback((eventCode: string) => {
    const sourceRules = eventCode === 'IDLE' ? config?.idleRules : config?.mouseRules;
    const rules = (sourceRules ?? [])
      .filter((rule) => rule.enabled && (eventCode === 'IDLE' || rule.eventCode === eventCode))
      .map((rule) => mergeRuleAction(rule, config?.actions ?? []));
    const selectedRule = selectWeightedRule(rules);

    if (!playRule(selectedRule)) {
      setStatus(`未配置：${eventCode === 'IDLE' ? '待机' : MOUSE_EVENTS.find((event) => event.value === eventCode)?.label ?? eventCode}`);
    }
  }, [config?.actions, config?.idleRules, config?.mouseRules, playRule]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    function handleClick(event: MouseEvent) {
      if (event.button !== 0 || event.detail !== 1) {
        return;
      }
      clearClickTimer();
      clickTimerRef.current = window.setTimeout(() => {
        clickTimerRef.current = null;
        triggerConfiguredAction('CLICK_LEFT');
      }, 240);
    }

    function handleDoubleClick() {
      clearClickTimer();
      triggerConfiguredAction('DOUBLE_CLICK_LEFT');
    }

    function handleContextMenu(event: MouseEvent) {
      event.preventDefault();
      clearClickTimer();
      triggerConfiguredAction('RIGHT_CLICK');
    }

    function handleWheel(event: WheelEvent) {
      if (event.deltaY < 0) {
        triggerConfiguredAction('WHEEL_UP');
      }
    }

    canvas.addEventListener('click', handleClick);
    canvas.addEventListener('dblclick', handleDoubleClick);
    canvas.addEventListener('contextmenu', handleContextMenu);
    canvas.addEventListener('wheel', handleWheel, { passive: true });

    return () => {
      clearClickTimer();
      canvas.removeEventListener('click', handleClick);
      canvas.removeEventListener('dblclick', handleDoubleClick);
      canvas.removeEventListener('contextmenu', handleContextMenu);
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, [clearClickTimer, triggerConfiguredAction]);

  useEffect(() => {
    if (!modelUrl) {
      return;
    }

    let disposed = false;
    const loadId = loadIdRef.current + 1;
    loadIdRef.current = loadId;

    const timeoutId = window.setTimeout(() => {
      async function loadPreviewModel() {
        const canvas = canvasRef.current;
        const frame = frameRef.current;
        if (!canvas || !frame) {
          return;
        }

        try {
          setStatus('加载中...');
          await loadLive2dScripts();

          if (disposed || loadId !== loadIdRef.current || !window.PIXI) {
            return;
          }

          let app = appRef.current;
          const initialSize = syncCanvasSize(canvas, frame, app);

          if (!app) {
            app = new window.PIXI.Application({
              view: canvas,
              autoStart: true,
              width: initialSize.width,
              height: initialSize.height,
              backgroundAlpha: 0,
              backgroundColor: 0xf7faff,
            });
            appRef.current = app;
          } else {
            app.stop();
          }

          syncCanvasSize(canvas, frame, app);

          const nextModel = await window.PIXI.live2d.Live2DModel.from(modelUrl);

          if (disposed || loadId !== loadIdRef.current) {
            return;
          }

          const currentModel = modelRef.current;
          if (currentModel) {
            app.stage.removeChild(currentModel);
            modelRef.current = null;
          }

          app.stage.addChild(nextModel);

          const naturalWidth = nextModel.width;
          const naturalHeight = nextModel.height;
          const layoutModel = () => {
            const size = syncCanvasSize(canvas, frame, app);
            const scale = Math.min(size.width / naturalWidth, size.height / naturalHeight) * 0.82;
            nextModel.scale.set(scale);
            nextModel.x = (size.width - naturalWidth * scale) / 2;
            nextModel.y = Math.max(0, (size.height - naturalHeight * scale) * 0.52);
          };
          layoutModelRef.current = layoutModel;
          layoutModel();

          makeDraggable(nextModel, {
            onDragStart: () => {
              dragStartXRef.current = nextModel.x;
            },
            onDragEnd: () => {
              const deltaX = nextModel.x - dragStartXRef.current;
              if (Math.abs(deltaX) >= 24) {
                triggerConfiguredAction(deltaX < 0 ? 'SLIDE_LEFT' : 'SLIDE_RIGHT');
              }
            },
          });

          nextModel.on('hit', (...args: unknown[]) => {
            const hitAreas = Array.isArray(args[0]) ? (args[0] as string[]) : [];
            if (hitAreas.includes('Head')) {
              nextModel.expression?.();
            }
          });

          modelRef.current = nextModel;
          app.start();
          setStatus('可调试');
        } catch (error) {
          console.error(error);
          setStatus('模型加载失败');
          appRef.current?.start();
        }
      }

      void loadPreviewModel();
    }, 0);

    return () => {
      disposed = true;
      window.clearTimeout(timeoutId);
    };
  }, [modelUrl, triggerConfiguredAction]);

  useEffect(() => () => {
    loadIdRef.current += 1;
    clearClickTimer();
    layoutModelRef.current = null;
    modelRef.current = null;
    appRef.current?.destroy(true, { children: true });
    appRef.current = null;
  }, [clearClickTimer]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      layoutModelRef.current?.();
    });
    resizeObserver.observe(frame);
    return () => resizeObserver.disconnect();
  }, []);

  return (
    <div className="model-action-preview">
      <div ref={frameRef} className="model-action-preview-frame">
        <canvas ref={canvasRef} className="model-action-preview-canvas" />
        {!modelUrl ? (
          <div className="model-action-preview-empty">请选择模型</div>
        ) : null}
      </div>
      <div className="model-action-preview-status">
        <span>{status}</span>
        <Button size="small" onClick={() => triggerConfiguredAction('IDLE')} disabled={!modelUrl}>
          测试待机
        </Button>
        <Button size="small" onClick={() => triggerConfiguredAction('CLICK_LEFT')} disabled={!modelUrl}>
          测试单击
        </Button>
      </div>
    </div>
  );
}

export default function ModelEmotionPage() {
  const [models, setModels] = useState<DigitalHumanModel[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<number | null>(null);
  const [config, setConfig] = useState<ActionTriggerConfig | null>(null);
  const [activeMode, setActiveMode] = useState<TriggerMode>('mouse');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [selectedMouseRuleKeys, setSelectedMouseRuleKeys] = useState<Key[]>([]);
  const [selectedTextRuleKeys, setSelectedTextRuleKeys] = useState<Key[]>([]);
  const [selectedIdleRuleKeys, setSelectedIdleRuleKeys] = useState<Key[]>([]);
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
      setSelectedIdleRuleKeys([]);
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

  function getRulesByMode(mode: TriggerMode) {
    if (mode === 'mouse') {
      return config?.mouseRules ?? [];
    }
    if (mode === 'text') {
      return config?.textRules ?? [];
    }
    return config?.idleRules ?? [];
  }

  function openRuleModal(mode: TriggerMode, index?: number) {
    const source = getRulesByMode(mode);
    const initial = index === undefined ? undefined : source?.[index];
    setEditing({ mode, index, initial });
    form.setFieldsValue({
      eventCode: initial?.eventCode || (mode === 'idle' ? 'IDLE' : 'CLICK_LEFT'),
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
      ruleType: editing.mode === 'mouse' ? 'MOUSE' : editing.mode === 'text' ? 'KEYWORD' : 'IDLE',
      eventCode: editing.mode === 'mouse' ? values.eventCode : editing.mode === 'idle' ? 'IDLE' : '',
      phrases: editing.mode === 'text' ? splitPhrases(values.phrasesText) : [],
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
      idleRules: editing.mode === 'idle' ? patchRules(config.idleRules) : config.idleRules,
    };
    const saved = await saveConfig(nextConfig, '动作配置已保存');
    if (saved) {
      closeRuleModal();
    }
  }

  async function removeRule(mode: TriggerMode, index: number) {
    if (!config) {
      return;
    }
    const nextConfig = {
      ...config,
      mouseRules: mode === 'mouse' ? config.mouseRules.filter((_, itemIndex) => itemIndex !== index) : config.mouseRules,
      textRules: mode === 'text' ? config.textRules.filter((_, itemIndex) => itemIndex !== index) : config.textRules,
      idleRules: mode === 'idle' ? config.idleRules.filter((_, itemIndex) => itemIndex !== index) : config.idleRules,
    };
    await saveConfig(nextConfig, '已删除并保存');
  }

  async function removeSelectedRules(mode: TriggerMode) {
    if (!config) {
      return;
    }
    const selectedKeys = mode === 'mouse' ? selectedMouseRuleKeys : mode === 'text' ? selectedTextRuleKeys : selectedIdleRuleKeys;
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
      idleRules: mode === 'idle'
        ? config.idleRules.filter((rule) => !selectedKeySet.has(getRuleRowKey('idle', rule)))
        : config.idleRules,
    };
    const saved = await saveConfig(nextConfig, '已批量删除并保存');
    if (saved) {
      if (mode === 'mouse') {
        setSelectedMouseRuleKeys([]);
      } else if (mode === 'text') {
        setSelectedTextRuleKeys([]);
      } else {
        setSelectedIdleRuleKeys([]);
      }
    }
  }

  async function toggleRule(mode: TriggerMode, index: number, enabled: boolean) {
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
      idleRules: mode === 'idle' ? patch(config.idleRules) : config.idleRules,
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
        idleRules: configToSave.idleRules.map((rule) => mergeRuleAction(rule, configToSave.actions)),
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

  const idleColumns: TableProps<ActionTriggerRule>['columns'] = [
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
        <Switch checked={enabled} size="small" loading={saving} onChange={(checked) => void toggleRule('idle', index, checked)} />
      ),
    },
    {
      title: '操作',
      width: 120,
      render: (_, _row, index) => (
        <Space>
          <Button aria-label="编辑" icon={<EditOutlined />} type="text" onClick={() => openRuleModal('idle', index)} />
          <Button aria-label="删除" icon={<DeleteOutlined />} type="text" danger loading={saving} onClick={() => void removeRule('idle', index)} />
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
            <ModelActionPreview model={selectedModel} config={config} />
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
            <Col xs={24} md={8}>
              <button
                type="button"
                className={activeMode === 'mouse' ? 'model-action-mode is-active' : 'model-action-mode'}
                onClick={() => setActiveMode('mouse')}
              >
                <strong>鼠标触发</strong>
                <span>通过点击、滑动、滚轮等交互触发动作</span>
              </button>
            </Col>
            <Col xs={24} md={8}>
              <button
                type="button"
                className={activeMode === 'text' ? 'model-action-mode is-active' : 'model-action-mode'}
                onClick={() => setActiveMode('text')}
              >
                <strong>关键词触发</strong>
                <span>通过用户输入、回答文本中的词语触发动作</span>
              </button>
            </Col>
            <Col xs={24} md={8}>
              <button
                type="button"
                className={activeMode === 'idle' ? 'model-action-mode is-active' : 'model-action-mode'}
                onClick={() => setActiveMode('idle')}
              >
                <strong>待机触发</strong>
                <span>数字人空闲时按动作选项自动播放</span>
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
        ) : activeMode === 'text' ? (
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
        ) : (
          <Card
            title="待机触发配置"
            extra={(
              <Space>
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  disabled={!selectedIdleRuleKeys.length}
                  loading={saving}
                  onClick={() => void removeSelectedRules('idle')}
                >
                  批量删除
                </Button>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => openRuleModal('idle')}>新增待机动作</Button>
              </Space>
            )}
          >
            <Table
              rowKey={(row) => getRuleRowKey('idle', row)}
              rowSelection={{
                selectedRowKeys: selectedIdleRuleKeys,
                onChange: (keys) => setSelectedIdleRuleKeys(keys),
              }}
              columns={idleColumns}
              dataSource={config.idleRules}
              loading={loading}
              pagination={{ pageSize: 10 }}
              size="middle"
            />
          </Card>
        )}

      </main>

      <Modal
        title={editing?.mode === 'mouse' ? '配置鼠标触发' : editing?.mode === 'text' ? '配置关键词触发' : '配置待机动作'}
        open={Boolean(editing)}
        onCancel={closeRuleModal}
        onOk={() => void saveRuleModal()}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          {editing?.mode === 'mouse' ? (
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
