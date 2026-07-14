import { getStoredUser } from '../auth/session'
import './ProfilePage.css'

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

export function ProfilePage() {
  const user = getStoredUser()
  const displayName = user?.displayName || user?.username || '未登录用户'
  const username = user?.username || '未设置'
  const roleLabel = user?.role === 'ADMIN' ? '管理员' : '游客'

  return (
    <main className="page-shell profile-page">
      <section className="page-content">
        <section className="profile-grid">
          <aside className="profile-identity">
            <div className="profile-identity__avatar">{getInitials(displayName)}</div>
            <div className="profile-identity__meta">
              <h1>{displayName}</h1>
              <span>@{username}</span>
            </div>
            <span className="profile-identity__role">{roleLabel}</span>
          </aside>

          <section className="profile-main">
            <section className="profile-stats" aria-label="游客数据">
              {MOCK_STATS.map((stat) => (
                <article key={stat.label} className="profile-stat-card">
                  <strong className="profile-stat-card__value">{stat.value}</strong>
                  <span className="profile-stat-card__label">{stat.label}</span>
                </article>
              ))}
            </section>

            <section className="profile-details">
              <h2>个人资料</h2>
              <dl>
                <div><dt>用户名</dt><dd>{username}</dd></div>
                <div><dt>显示名称</dt><dd>{user?.displayName || '未设置'}</dd></div>
                <div><dt>角色</dt><dd>{roleLabel}</dd></div>
              </dl>
              <p>资料修改功能即将上线，敬请期待</p>
            </section>
          </section>
        </section>
      </section>
    </main>
  )
}
