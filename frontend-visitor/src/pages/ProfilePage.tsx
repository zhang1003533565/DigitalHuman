import { getStoredUser } from '../auth/session'
import { VisitorTopNav } from '../components/VisitorTopNav'
import './ProfilePage.css'

type ProfilePageProps = {
  onLogout: () => void
}

const MOCK_STATS = [
  { label: '注册时间', value: '2025-03-15' },
  { label: '导览会话', value: '27 次' },
  { label: '收藏景点', value: '12 个' },
  { label: '反馈记录', value: '5 条' },
]

function getInitials(name: string): string {
  if (!name) return 'U'
  return name.charAt(0).toUpperCase()
}

export function ProfilePage({ onLogout }: ProfilePageProps) {
  const user = getStoredUser()

  return (
    <main className="page-shell">
      <VisitorTopNav onLogout={onLogout} />
      <section className="page-content">
        <section className="profile-grid">
          <aside className="profile-card">
            <div className="profile-card__avatar">
              {getInitials(user?.displayName || user?.username || '')}
            </div>
            <div className="profile-card__meta">
              <h2 className="profile-card__name">{user?.displayName || user?.username}</h2>
              <span className="profile-card__username">@{user?.username}</span>
              <span className="profile-card__role">
                {user?.role === 'ADMIN' ? '管理员' : '游客'}
              </span>
            </div>
          </aside>

          <section className="profile-main">
            <div className="profile-stats">
              {MOCK_STATS.map((stat) => (
                <article key={stat.label} className="profile-stat-card">
                  <span className="profile-stat-card__value">{stat.value}</span>
                  <span className="profile-stat-card__label">{stat.label}</span>
                </article>
              ))}
            </div>

            <div className="profile-section">
              <h3 className="profile-section__title">个人资料</h3>
              <div className="profile-form">
                <label className="profile-form__field">
                  <span>用户名</span>
                  <input
                    className="profile-form__input"
                    type="text"
                    value={user?.username || ''}
                    disabled
                  />
                </label>
                <label className="profile-form__field">
                  <span>显示名称</span>
                  <input
                    className="profile-form__input"
                    type="text"
                    value={user?.displayName || ''}
                    disabled
                  />
                </label>
                <label className="profile-form__field">
                  <span>角色</span>
                  <input
                    className="profile-form__input"
                    type="text"
                    value={user?.role === 'ADMIN' ? '管理员' : '游客'}
                    disabled
                  />
                </label>
                <p className="profile-form__hint">资料修改功能即将上线，敬请期待</p>
              </div>
            </div>
          </section>
        </section>
      </section>
    </main>
  )
}
