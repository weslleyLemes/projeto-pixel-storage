import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, logAction, refreshCsrf } from './api'
import type { User } from './App'
import { Cloud, LockKeyhole } from 'lucide-react'

export function Auth({ onAuth }: { onAuth: (user: User) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()

  function changeMode(nextMode: 'login' | 'register') {
    if (busy) return
    logAction('auth.mode.changed', { mode: nextMode })
    setError('')
    setConfirm('')
    setMode(nextMode)
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); setError('')
    logAction(`auth.${mode}.started`)
    if (mode === 'register' && password !== confirm) { logAction('auth.register.validation_failed', { reason: 'password_mismatch' }); setError('As senhas não coincidem.'); return }
    setBusy(true)
    try {
      await new Promise(resolve => setTimeout(resolve, 2000))
      await refreshCsrf()
      const { data } = await api.post(`/auth/${mode}`, { email, password })
      onAuth(data.user); navigate('/dashboard')
      logAction(`auth.${mode}.completed`)
    } catch (e: any) { logAction(`auth.${mode}.failed`, { status: e.response?.status || 0 }); setError(e.response?.data?.error || 'Não foi possível concluir. Tente novamente.') }
    finally { setBusy(false) }
  }

  return <main className="auth-shell">
    <section className="auth-visual">
      <div className="brand"><span className="brand-mark"><Cloud size={23}/></span><span className="brand-name">Pixel Breeders <em>projeto camada</em></span></div>
      <div className="visual-copy"><p className="eyebrow">SEU ESPAÇO DIGITAL</p><h1>Arquivos.<br/><em>Organizados.</em></h1><div className="visual-orb orb-one"/><div className="visual-orb orb-two"/></div>
      <small>PIXEL BREEDERS PROJETO CAMADA</small>
    </section>
    <section className="auth-panel">
      <div className={`auth-card ${busy ? 'is-loading' : ''}`}>
        {busy && <div className="auth-loading-overlay" aria-live="polite" aria-busy="true"><div className="spinner"/><span>{mode === 'login' ? 'Entrando...' : 'Criando conta...'}</span></div>}
        <div className="icon-tile"><LockKeyhole/></div>
        <p className="eyebrow">BEM-VINDO AO PIXEL BREEDERS</p>
        <h2>{mode === 'login' ? 'Acesse sua conta' : 'Crie sua conta'}</h2>
        <p className="muted">{mode === 'login' ? 'Entre para acessar seus arquivos.' : 'Comece a organizar seus arquivos agora.'}</p>
        <div className="switch"><button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => changeMode('login')} disabled={busy}>Entrar</button><button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => changeMode('register')} disabled={busy}>Criar conta</button></div>
        <form onSubmit={submit}>
          <div className="auth-fields">
            <label>E-mail</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="voce@exemplo.com" required />
            <label>Senha</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={mode === 'register' ? 'Mínimo de 8 caracteres' : 'Sua senha'} minLength={mode === 'register' ? 8 : undefined} required />
            {mode === 'register' && <><label>Confirmar senha</label><input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repita sua senha" required /></>}
            {error && <div className="error">{error}</div>}
          </div>
          <button className="primary full" type="submit" disabled={busy}>{busy ? 'Aguarde...' : mode === 'login' ? 'Entrar na plataforma' : 'Criar minha conta'}</button>
        </form>
        <p className="security-note"><LockKeyhole size={14}/> Seus dados são protegidos por sessão segura.</p>
      </div>
    </section>
  </main>
}
