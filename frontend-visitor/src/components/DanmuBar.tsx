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

      if (onAISpeak) {
        const reply = getAIReply(mock.content)
        setTimeout(() => onAISpeak(reply), 1500)
      }

      setTimeout(sendDanmu, 30000 + Math.random() * 10000)
    }

    const timer = setTimeout(sendDanmu, 2000)
    return () => clearTimeout(timer)
  }, [height, onAISpeak])

  useEffect(() => {
    if (userQuestion) {
      const newDanmu: FlyingDanmu = {
        id: Date.now(),
        userName: '我',
        content: userQuestion,
        isUser: true,
        top: Math.random() * (height - 30),
        duration: 12,
        key: Date.now(),
      }
      setDanmus((prev) => [...prev, newDanmu])
    }
  }, [userQuestion, height])

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