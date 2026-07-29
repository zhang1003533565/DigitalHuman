import { lazy, Suspense, useState } from 'react'
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
import { MobileBottomNav } from './components/MobileBottomNav'
import { VisitorTopNav } from './components/VisitorTopNav'
import { VisitorThemeProvider } from './theme/VisitorThemeProvider'

const HomePage = lazy(() => import('./pages/HomePage').then((module) => ({ default: module.HomePage })))
const LoginPage = lazy(() => import('./pages/LoginPage').then((module) => ({ default: module.LoginPage })))
const DigitalHumanPage = lazy(() => import('./pages/DigitalHumanPage').then((module) => ({ default: module.DigitalHumanPage })))
const RouteRecommendPage = lazy(() => import('./pages/RouteRecommendPage').then((module) => ({ default: module.RouteRecommendPage })))
const MapPage = lazy(() => import('./pages/MapPage').then((module) => ({ default: module.MapPage })))
const FeedbackPage = lazy(() => import('./pages/FeedbackPage').then((module) => ({ default: module.FeedbackPage })))
const HistoryPage = lazy(() => import('./pages/HistoryPage').then((module) => ({ default: module.HistoryPage })))
const ProfilePage = lazy(() => import('./pages/ProfilePage').then((module) => ({ default: module.ProfilePage })))
const TravelTipsPage = lazy(() => import('./pages/TravelTipsPage').then((module) => ({ default: module.TravelTipsPage })))
const SpotRecommendPage = lazy(() => import('./pages/SpotRecommendPage').then((module) => ({ default: module.SpotRecommendPage })))
const RouteRecommendListPage = lazy(() => import('./pages/RouteRecommendListPage').then((module) => ({ default: module.RouteRecommendListPage })))
const LiveBroadcastPage = lazy(() => import('./pages/LiveBroadcastPage').then((module) => ({ default: module.LiveBroadcastPage })))

function ProtectedRoute({ user, onLogout }: { user: SessionUser | null; onLogout: () => void }) {
  const location = useLocation()

  if (!user) {
    const redirect = `${location.pathname}${location.search}`
    return <Navigate to={`/login?redirect=${encodeURIComponent(redirect)}`} replace />
  }

  return (
    <VisitorThemeProvider>
      <div className="authenticated-app">
        <VisitorTopNav onLogout={onLogout} />
        <div className="authenticated-app__content">
          <Outlet />
        </div>
        <MobileBottomNav />
      </div>
    </VisitorThemeProvider>
  )
}

function LiveBroadcastLayout({ user }: { user: SessionUser | null }) {
  if (!user) {
    return <Navigate to="/login" replace />
  }
  return <LiveBroadcastPage />
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
    <Suspense fallback={<div className="app-route-loading" aria-live="polite">加载中...</div>}>
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
          <Route path="/routes" element={<RouteRecommendPage />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/spot-recommend" element={<SpotRecommendPage />} />
          <Route path="/route-recommend" element={<RouteRecommendListPage />} />
          <Route path="/feedback" element={<FeedbackPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/tips" element={<TravelTipsPage />} />
        </Route>
        <Route path="/live" element={<LiveBroadcastLayout user={user} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

export default App
