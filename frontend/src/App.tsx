import { useEffect, useState } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { api, logAction, refreshCsrf } from './api'
import { Auth } from './Auth'
import { Dashboard } from './Dashboard'
import { Admin } from './Admin'

export type User = { id: number; email: string; role: 'user' | 'admin' }

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    logAction('navigation.changed', { path: location.pathname })
  }, [location.pathname])

  useEffect(() => {
    function logButtonClick(event: MouseEvent) {
      if (!(event.target instanceof Element)) return
      const button = event.target.closest('button')
      if (!button) return
      const label = button.getAttribute('aria-label') || button.getAttribute('data-tooltip') || button.textContent?.trim().slice(0, 40) || 'unlabeled'
      logAction('ui.button.clicked', { label })
    }

    document.addEventListener('click', logButtonClick)
    return () => document.removeEventListener('click', logButtonClick)
  }, [])

  // Restaura a sessão no refresh; a autenticação real é validada pelo backend.
  useEffect(() => {
    refreshCsrf().then(() => api.get('/auth/me').then(r => setUser(r.data.user)).catch(() => setUser(null)))
      .finally(() => setReady(true))
  }, [])

  async function logout() {
    logAction('auth.logout.started')
    try {
      await refreshCsrf()
      await api.post('/auth/logout')
      setUser(null)
      await refreshCsrf()
      navigate('/')
      logAction('auth.logout.completed')
    } catch (error: any) {
      logAction('auth.logout.failed', { status: error.response?.status || 0 })
    }
  }

  if (!ready) return <div className="loading">Preparando seu espaço...</div>
  return <Routes>
    <Route path="/" element={user ? <Navigate to="/dashboard" /> : <Auth onAuth={setUser} />} />
    <Route path="/dashboard" element={user ? <Dashboard user={user} onLogout={logout} /> : <Navigate to="/" />} />
    <Route path="/admin" element={user?.role === 'admin' ? <Admin onBack={() => navigate('/dashboard')} /> : <Navigate to="/dashboard" />} />
    <Route path="*" element={<Navigate to={user ? '/dashboard' : '/'} />} />
  </Routes>
}
