import { useState } from 'react'
import HeartIcon from './HeartIcon'
import './ActionButtons.css'

interface Floating {
  id: number
  type: 'heart' | 'like'
  left: number
  size: number
  duration: number
  rotate: number
}

const LIKE_EMOJIS = ['👍', '👍🏻', '👍🏼', '👍🏽']

export default function ActionButtons() {
  const [likes, setLikes] = useState(1200)
  const [hearts, setHearts] = useState(3580)
  const [floatings, setFloatings] = useState<Floating[]>([])

  const handleClick = (type: 'like' | 'heart') => {
    if (type === 'like') setLikes((n) => n + 1)
    if (type === 'heart') setHearts((n) => n + 1)

    const count = 5 + Math.floor(Math.random() * 4)
    const newOnes: Floating[] = []

    for (let i = 0; i < count; i++) {
      newOnes.push({
        id: Date.now() + Math.random() + i,
        type,
        left: 15 + Math.random() * 70,
        size: 28 + Math.random() * 22,
        duration: 2.2 + Math.random() * 1,
        rotate: -20 + Math.random() * 40,
      })
    }

    setFloatings((prev) => [...prev, ...newOnes])

    setTimeout(() => {
      setFloatings((prev) =>
        prev.filter((f) => !newOnes.find((n) => n.id === f.id))
      )
    }, 3500)
  }

  return (
    <div className="action-buttons">
      <button
        className="action-btn like-btn"
        onClick={() => handleClick('like')}
        type="button"
      >
        <span className="action-icon">👍</span>
        <span className="action-count">{likes}</span>
      </button>

      <button
        className="action-btn heart-btn"
        onClick={() => handleClick('heart')}
        type="button"
      >
        <span className="action-icon">
          <HeartIcon size={20} />
        </span>
        <span className="action-count">{hearts}</span>
      </button>

      {/* 漂浮层 */}
      <div className="floating-layer">
        {floatings.map((f) => (
          <span
            key={f.id}
            className="floating-emoji"
            style={{
              left: `${f.left}%`,
              fontSize: `${f.size}px`,
              animationDuration: `${f.duration}s`,
              transform: `rotate(${f.rotate}deg)`,
            }}
          >
            {f.type === 'heart' ? (
              <HeartIcon
                size={f.size}
                color="#F03D5C"
                highlight="#FF7E97"
                shadow="#C41E3D"
              />
            ) : (
              LIKE_EMOJIS[Math.floor(Math.random() * LIKE_EMOJIS.length)]
            )}
          </span>
        ))}
      </div>
    </div>
  )
}