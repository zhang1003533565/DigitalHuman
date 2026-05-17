import { useEffect, useState } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import './App.css'
import {
  DEFAULT_AUTH_REDIRECT,
  clearUser,
  getStoredUser,
  saveUser,
  type SessionUser,
} from './auth/session'
import { DIGITAL_HUMAN_ROUTE } from './digitalHuman/shared'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { DigitalHumanPage } from './pages/DigitalHumanPage'
import { RouteRecommendPage } from './pages/RouteRecommendPage'
import { MapPage } from './pages/MapPage'
import { FeedbackPage } from './pages/FeedbackPage'
import { HistoryPage } from './pages/HistoryPage'

function ProtectedRoute({ user }: { user: SessionUser | null }) {
  const location = useLocation()

  if (!user) {
    const redirect = `${location.pathname}${location.search}`
    return <Navigate to={`/login?redirect=${encodeURIComponent(redirect)}`} replace />
  }

  return <Outlet />
}

function App() {
  const [user, setUser] = useState<SessionUser | null>(null)

  useEffect(() => {
    setUser(getStoredUser())
  }, [])

  function handleLogin(username: string) {
    setUser(saveUser(username))
  }

  function handleLogout() {
    clearUser()
    setUser(null)
  }

  return (
    <Routes>
      <Route
        path="/"
        element={<Navigate to={user ? DEFAULT_AUTH_REDIRECT : '/login'} replace />}
      />
      <Route
        path="/login"
        element={<LoginPage user={user} onLogin={handleLogin} />}
      />
      <Route element={<ProtectedRoute user={user} />}>
        <Route
          path="/home"
          element={<HomePage user={user as SessionUser} onLogout={handleLogout} />}
        />
        <Route
          path={DIGITAL_HUMAN_ROUTE}
          element={<DigitalHumanPage onLogout={handleLogout} />}
        />
        <Route path="/routes" element={<RouteRecommendPage onLogout={handleLogout} />} />
        <Route path="/map" element={<MapPage onLogout={handleLogout} />} />
        <Route path="/feedback" element={<FeedbackPage onLogout={handleLogout} />} />
        <Route path="/history" element={<HistoryPage onLogout={handleLogout} />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
