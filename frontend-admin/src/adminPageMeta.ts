export type AdminPageKey =
  | 'dashboard' | 'home-config' | 'spots' | 'spot-category' | 'facility-list'
  | 'routes' | 'travel-tips' | 'avatar' | 'model-emotion' | 'settings'
  | 'travel-analytics' | 'scenic-structured' | 'voice-scripts' | 'feedback'
  | 'live-broadcast' | 'qa' | 'ai-models' | 'knowledge' | 'map-config'

export type AdminPageMeta = { title: string; eyebrow: string; description: string }

export const adminPageMeta: Record<AdminPageKey, AdminPageMeta> = {
  dashboard: { title: '运营总览', eyebrow: 'OPERATIONS COCKPIT', description: '实时掌握景区客流、数字人服务、知识命中与运行告警' },
  'home-config': { title: '首页配置', eyebrow: 'HOME EXPERIENCE', description: '维护游客端首页内容、快捷行程与推荐展示策略' },
  spots: { title: '景点管理', eyebrow: 'SCENIC SPOTS', description: '维护景点基础资料、位置、开放状态与游客端展示' },
  'spot-category': { title: '景点分类', eyebrow: 'SPOT TAXONOMY', description: '维护景点分类体系、展示顺序和启用状态' },
  'facility-list': { title: '全部设施', eyebrow: 'FACILITIES', description: '统一管理停车场、卫生间、医疗点与游客服务设施' },
  routes: { title: '路线管理', eyebrow: 'ROUTE OPERATIONS', description: '编排游览路线、途经节点、适用人群与发布状态' },
  'travel-analytics': { title: '旅游数据行为分析', eyebrow: 'BEHAVIOR ANALYTICS', description: '从会话、路线与偏好数据中识别趋势和异常' },
  'scenic-structured': { title: '景点结构化数据', eyebrow: 'STRUCTURED DATA', description: '校验景点核心字段、坐标、开放时间与关联数据' },
  'voice-scripts': { title: '景点口播管理', eyebrow: 'VOICE SCRIPTS', description: '维护数字人讲解文案、音色、时长与发布版本' },
  'travel-tips': { title: '游览贴士', eyebrow: 'TRAVEL TIPS', description: '发布天气、安全、交通与景区服务提示' },
  avatar: { title: '数字人基础配置', eyebrow: 'DIGITAL HUMAN', description: '配置形象、音色、语速、欢迎语和导览服务策略' },
  'model-emotion': { title: '数字人动作配置', eyebrow: 'MOTION & EMOTION', description: '管理数字人的动作、表情、触发条件和预览效果' },
  feedback: { title: '游客反馈分析', eyebrow: 'VISITOR VOICE', description: '追踪游客评价、问题分类、处理状态与体验趋势' },
  'live-broadcast': { title: '数字人直播', eyebrow: 'LIVE BROADCAST', description: '维护轮播文案、发布版本并监控持续直播状态' },
  qa: { title: '问答记录查询', eyebrow: 'CONVERSATION TRACE', description: '检索游客问答、知识命中、响应状态和会话详情' },
  'ai-models': { title: 'AI 模型管理', eyebrow: 'MODEL CONTROL', description: '统一管理模型目录、供应商连接、绑定关系和健康测试' },
  knowledge: { title: '知识库对接站', eyebrow: 'KNOWLEDGE HUB', description: '管理知识目录、文档分段与第三方知识服务连接' },
  'map-config': { title: '地图配置', eyebrow: 'AMAP SETTINGS', description: '维护高德地图 Web Key 与安全密钥，供游客端和管理端地图运行时读取' },
  settings: { title: '系统设置', eyebrow: 'SYSTEM SETTINGS', description: '配置模型能力、服务参数与智能体编排策略' },
}

export function getAdminPageMeta(key: AdminPageKey) {
  return adminPageMeta[key] ?? adminPageMeta.dashboard
}
