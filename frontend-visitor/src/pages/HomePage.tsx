import { useNavigate } from 'react-router-dom'
import '../App.css'
import { type SessionUser } from '../auth/session'
import { DIGITAL_HUMAN_ROUTE } from '../digitalHuman/shared'
import { AppTopNav } from '../components/AppTopNav'

type HomePageProps = {
  user: SessionUser
  onLogout: () => void
}

export function HomePage({ user, onLogout }: HomePageProps) {
  const navigate = useNavigate()

  return (
    <main className="page-shell">
      <AppTopNav onLogout={onLogout} />
      <section className="page-content">
        <header className="hero-panel">
          <div>
            <p className="surface-tag">Welcome Back</p>
            <h1>{user.username}，欢迎进入数字人首页</h1>
            <p className="surface-copy">
              首页现在只是其中一个入口页。后续景点页、活动页、导览页都可以直接跳到数字人模块。
            </p>
          </div>
          <button className="ghost-button" type="button" onClick={() => navigate(DIGITAL_HUMAN_ROUTE)}>
            进入数字人模块
          </button>
        </header>

        <section className="home-grid">
          <article className="feature-card feature-card--primary">
            <p className="card-kicker">核心入口</p>
            <h2>数字人模块</h2>
            <p>
              作为独立功能页存在，负责模型切换、音色切换、本地测试和 TTS 驱动口型。
            </p>
            <button type="button" onClick={() => navigate(DIGITAL_HUMAN_ROUTE)}>
              进入数字人模块
            </button>
          </article>

          <article className="feature-card">
            <p className="card-kicker">后续扩展</p>
            <h2>多入口接入</h2>
            <p>后续你可以在景点详情、活动报名、导览咨询等页面直接跳转到这个独立路由。</p>
            <button type="button" onClick={() => navigate(DIGITAL_HUMAN_ROUTE)}>
              从这里也能进入
            </button>
          </article>

          <article className="feature-card">
            <p className="card-kicker">当前能力</p>
            <h2>路由结构</h2>
            <ul className="feature-list">
              <li>`/login` 登录页</li>
              <li>`/home` 首页</li>
              <li>`/modules/digital-human` 数字人模块页</li>
              <li>`/routes` 路线推荐</li>
              <li>`/map` 景点地图</li>
              <li>`/feedback` 反馈记录</li>
              <li>`/history` 会话历史</li>
            </ul>
          </article>
        </section>
      </section>
    </main>
  )
}
