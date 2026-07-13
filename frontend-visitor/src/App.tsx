import { useState } from 'react'
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
import { ProfilePage } from './pages/ProfilePage'
import { TravelTipsPage } from './pages/TravelTipsPage'
import { SpotRecommendPage } from './pages/SpotRecommendPage'
import { RouteRecommendListPage } from './pages/RouteRecommendListPage'
import { MobileBottomNav } from './components/MobileBottomNav'
import { VisitorTopNav } from './components/VisitorTopNav'
import { LiveBroadcastPage } from './pages/LiveBroadcastPage'

function ProtectedRoute({ user, onLogout }: { user: SessionUser | null; onLogout: () => void }) {
  const location = useLocation()

  if (!user) {
    const redirect = `${location.pathname}${location.search}`
    return <Navigate to={`/login?redirect=${encodeURIComponent(redirect)}`} replace />
  }

  return (
    <div className="authenticated-app">
      <VisitorTopNav onLogout={onLogout} />
      <div className="authenticated-app__content">
        <Outlet />
      </div>
      <MobileBottomNav />
    </div>
  )
}

function App() {
  const [user, setUser] = useState<SessionUser | null>(() => getStoredUser())

  function handleLogin(nextUser: SessionUser) {
    setUser(saveUser(nextUser))
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
      <Route element={<ProtectedRoute user={user} onLogout={handleLogout} />}>
        <Route
          path="/home"
          element={<HomePage user={user as SessionUser} />}
        />
        <Route
          path={DIGITAL_HUMAN_ROUTE}
          element={<DigitalHumanPage />}
        />
        <Route path="/live" element={<LiveBroadcastPage />} />
        <Route path="/routes" element={<RouteRecommendPage />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/spot-recommend" element={<SpotRecommendPage />} />
        <Route path="/route-recommend" element={<RouteRecommendListPage />} />
        <Route path="/feedback" element={<FeedbackPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/tips" element={<TravelTipsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
