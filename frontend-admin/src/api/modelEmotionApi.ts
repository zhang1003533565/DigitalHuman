const API_BASE = '/api/admin/model-emotion';
const SESSION_STORAGE_KEY = 'digitalhuman.admin.user';

function getAuthHeaders(): Record<string, string> {
  const userStr = sessionStorage.getItem(SESSION_STORAGE_KEY);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (!userStr) {
    return headers;
  }

  try {
    const user = JSON.parse(userStr);
    if (user?.token) {
      headers.Authorization = `Bearer ${user.token}`;
    }
  } catch {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  }

  return headers;
}

function redirectToLogin() {
  sessionStorage.removeItem(SESSION_STORAGE_KEY);
  window.location.reload();
}

async function fetchJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401) {
      redirectToLogin();
    }

    const message = data?.error || data?.message || `请求失败: ${response.status}`;
    throw new Error(message);
  }

  return data as T;
}

export type ModelAction = {
  id: number;
  actionKey: string;
  actionName: string;
  motionFilePath: string;
  groupName: string;
  actionIndex: number;
  enabled: boolean;
};

export type DigitalHumanModel = {
  id: number;
  modelKey: string;
  displayName: string;
  modelPath: string;
  status: string;
  updatedAt?: string;
};

export type ActionRuleType = 'MOUSE' | 'KEYWORD' | 'IDLE';

export type ActionTriggerRule = {
  id?: number;
  ruleType: ActionRuleType;
  eventCode?: string;
  phrases: string[];
  actionId: number;
  actionName?: string;
  motionFilePath?: string;
  groupName?: string;
  actionIndex?: number;
  enabled: boolean;
  priority: number;
};

export type ModelDetail = DigitalHumanModel & {
  allActions: ModelAction[];
  enabledActions: ModelAction[];
};

export type ActionTriggerConfig = {
  model: DigitalHumanModel;
  actions: ModelAction[];
  mouseRules: ActionTriggerRule[];
  textRules: ActionTriggerRule[];
  idleRules: ActionTriggerRule[];
};

export const modelEmotionApi = {
  getModels: () => fetchJson<DigitalHumanModel[]>(`${API_BASE}/models`),

  scanModels: () => fetchJson<DigitalHumanModel[]>(`${API_BASE}/models/scan`, { method: 'POST' }),

  getModelDetail: (id: number) => fetchJson<ModelDetail>(`${API_BASE}/models/${id}`),

  updateModelActions: (id: number, enabledActionIds: number[]) => fetchJson<ModelAction[]>(
    `${API_BASE}/models/${id}/actions`,
    {
      method: 'PUT',
      body: JSON.stringify({ enabledActionIds }),
    },
  ),

  getModelActions: (id: number) => fetchJson<ModelAction[]>(`${API_BASE}/models/${id}/actions`),

  getTriggerConfig: (id: number) => fetchJson<ActionTriggerConfig>(`${API_BASE}/models/${id}/trigger-config`),

  saveTriggerConfig: (id: number, data: Pick<ActionTriggerConfig, 'mouseRules' | 'textRules' | 'idleRules'>) => fetchJson<ActionTriggerConfig>(
    `${API_BASE}/models/${id}/trigger-config`,
    {
      method: 'PUT',
      body: JSON.stringify(data),
    },
  ),

};
