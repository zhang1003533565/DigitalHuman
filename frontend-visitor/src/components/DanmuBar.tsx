import { useEffect, useRef, useState } from 'react'
import { MOCK_DANMU, getAIReply, type DanmuItem } from '../data/mockDanmu'
import './DanmuBar.css'

interface FlyingDanmu extends DanmuItem {
  top: number
  duration: number
  key: number
}

interface Props {
  userQuestion?: string
  onAISpeak?: (text: string) => void
}

export default function DanmuBar({ userQuestion, onAISpeak }: Props) {
  const [danmus, setDanmus] = useState<FlyingDanmu[]>([])
  const indexRef = useRef(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(60)
  const nextSendTimerRef = useRef<number | null>(null)
  const replyTimerRef = useRef<number | null>(null)
  // 用 ref 保存回调：父组件每次渲染都会换一个新函数，
  // 直接放进依赖会让弹幕节奏被无谓地重置。
  const onAISpeakRef = useRef(onAISpeak)

  useEffect(() => {
    onAISpeakRef.current = onAISpeak
  }, [onAISpeak])

  useEffect(() => {
    if (containerRef.current) {
      setHeight(containerRef.current.clientHeight)
    }
  }, [])

  useEffect(() => {
    const sendDanmu = () => {
      const mock = MOCK_DANMU[indexRef.current % MOCK_DANMU.length]
      indexRef.current++

      const top = Math.random() * (height - 30)

      const newDanmu: FlyingDanmu = {
        ...mock,
        top,
        duration: 12 + Math.random() * 4,
        key: Date.now() + Math.random(),
      }

      setDanmus((prev) => [...prev, newDanmu])

      replyTimerRef.current = window.setTimeout(() => {
        replyTimerRef.current = null
        onAISpeakRef.current?.(getAIReply(mock.content))
      }, 1500)

      nextSendTimerRef.current = window.setTimeout(sendDanmu, 30000 + Math.random() * 10000)
    }

    nextSendTimerRef.current = window.setTimeout(sendDanmu, 2000)
    return () => {
      if (nextSendTimerRef.current !== null) {
        window.clearTimeout(nextSendTimerRef.current)
        nextSendTimerRef.current = null
      }
      // 卸载后不再触发弹幕语音，避免离开页面后数字人还在自问自答。
      if (replyTimerRef.current !== null) {
        window.clearTimeout(replyTimerRef.current)
        replyTimerRef.current = null
      }
    }
  }, [height])

  // 用户自己的提问也飘一条弹幕。用 React 的“props 变化时在渲染期调整 state”写法，
  // 而不是在 effect 里 setState —— 后者会触发级联渲染，也会在容器高度变化时重复飘同一句。
  // 初值取 undefined：即使父组件在挂载时就传入提问，也照旧飘一条。
  const [prevUserQuestion, setPrevUserQuestion] = useState<string | undefined>(undefined)
  if (userQuestion !== prevUserQuestion) {
    setPrevUserQuestion(userQuestion)
    if (userQuestion) {
      setDanmus((prev) => [
        ...prev,
        {
          id: Date.now(),
          userName: '我',
          content: userQuestion,
          isUser: true,
          top: Math.random() * (height - 30),
          duration: 12,
          key: Date.now() + Math.random(),
        },
      ])
    }
  }

  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now()
      setDanmus((prev) => prev.filter((d) => now - d.key < d.duration * 1000))
    }, 2000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="danmu-bar" ref={containerRef}>
      {danmus.map((d) => (
        <div
          key={d.key}
          className={`danmu-item ${d.isUser ? 'danmu-user' : ''}`}
          style={{
            top: `${d.top}px`,
            animationDuration: `${d.duration}s`,
          }}
        >
          <span className="danmu-user-name">{d.userName}：</span>
          <span className="danmu-content">{d.content}</span>
        </div>
      ))}
    </div>
  )
}