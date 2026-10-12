export interface DanmuItem {
  id: number
  userName: string
  content: string
  isUser?: boolean
  isAI?: boolean
}

export const MOCK_DANMU: DanmuItem[] = [
  { id: 1, userName: '用户***123', content: '这个景点好玩吗？' },
  { id: 2, userName: '用户***456', content: '门票多少钱啊？' },
  { id: 3, userName: '用户***789', content: '怎么预约导览？' },
  { id: 4, userName: '用户***321', content: '语音是怎么合成的？' },
  { id: 5, userName: '用户***654', content: '可以推荐一下路线吗？' },
  { id: 6, userName: '用户***987', content: '数字人好可爱！' },
  { id: 7, userName: '用户***111', content: '支持大境门！' },
  { id: 8, userName: '用户***222', content: '可以英文讲解吗？' },
  { id: 9, userName: '用户***333', content: '周边有停车场吗？' },
  { id: 10, userName: '用户***444', content: '什么时候开放？' },
  { id: 11, userName: '用户***555', content: '有没有适合老人的路线？' },
  { id: 12, userName: '用户***666', content: '可以扫码听讲解吗？' },
  { id: 13, userName: '用户***777', content: '这个AI真智能！' },
  { id: 14, userName: '用户***888', content: '附近有吃饭的地方吗？' },
  { id: 15, userName: '用户***999', content: '数字人讲得真好！' },
]

export const AI_DANMU_REPLIES: Record<string, string> = {
  '好玩': '这里非常值得一游，大境门是万里长城第一门，历史文化底蕴深厚！',
  '门票': '大境门景区门票非常实惠，具体价格请以景区公告为准。',
  '预约': '您可以扫描景区二维码预约导览，非常方便。',
  '语音': '我用的是 AI 语音合成技术，可以实时为大家讲解。',
  '路线': '推荐您从大境门出发，沿长城一路向南，途经多个历史遗迹。',
  '可爱': '谢谢夸奖！我会继续努力为大家服务~',
  '英文': '目前我支持中英文讲解，可以随时切换哦。',
  '停车': '景区周边有大型停车场，方便自驾游客。',
  '开放': '景区每天早上 8 点开放，欢迎前来参观。',
  '老人': '我们专门设计了适合老人的舒适路线，全程平缓。',
  '吃饭': '景区附近有很多特色餐厅，可以品尝当地美食。',
  '智能': '谢谢！我是基于 AI 技术的数字人助手。',
}

export function getAIReply(content: string): string {
  for (const [key, value] of Object.entries(AI_DANMU_REPLIES)) {
    if (content.includes(key)) return value
  }
  return '感谢大家的关注，我会继续为您提供导览服务！'
}