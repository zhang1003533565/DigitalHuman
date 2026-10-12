interface Props {
  size?: number
  color?: string       // 主色
  highlight?: string   // 高光色
  shadow?: string      // 阴影色
}

export default function HeartIcon({
  size = 36,
  color = '#F03D5C',
  highlight = '#FF7E97',
  shadow = '#C41E3D',
}: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* 主体渐变 */}
        <radialGradient id="heartMain" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor={highlight} />
          <stop offset="55%" stopColor={color} />
          <stop offset="100%" stopColor={shadow} />
        </radialGradient>
        {/* 高光渐变 */}
        <radialGradient id="heartHighlight" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* 心形主体（带描边） */}
      <path
        d="M50 90
           C 20 68, 5 50, 5 33
           C 5 18, 18 8, 32 8
           C 41 8, 47 12, 50 20
           C 53 12, 59 8, 68 8
           C 82 8, 95 18, 95 33
           C 95 50, 80 68, 50 90 Z"
        fill="url(#heartMain)"
        stroke={shadow}
        strokeWidth="3"
        strokeLinejoin="round"
      />

      {/* 左上高光（玻璃球效果） */}
      <ellipse
        cx="32"
        cy="30"
        rx="12"
        ry="9"
        fill="url(#heartHighlight)"
        transform="rotate(-25 32 30)"
      />

      {/* 右下暗角（加强立体感） */}
      <ellipse
        cx="70"
        cy="72"
        rx="10"
        ry="8"
        fill={shadow}
        opacity="0.25"
        transform="rotate(20 70 72)"
      />
    </svg>
  )
}