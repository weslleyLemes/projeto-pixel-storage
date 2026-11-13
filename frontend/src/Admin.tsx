import { useEffect, useState } from 'react'
import { api, logAction, refreshCsrf } from './api'
import { ArrowLeft, Users, Trash2, ShieldCheck } from 'lucide-react'

type AdminUser = { id: number; email: string; role: string; createdAt: string; fileCount: number }
export function Admin({ onBack }: { onBack: () => void }) {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [error, setError] = useState('')
  async function load() { const { data } = await api.get('/admin/users'); setUsers(data.users) }
  useEffect(() => { load().catch(() => setError('Não foi possível carregar os usuários.')) }, [])
  const [deleteUser, setDeleteUser] = useState<AdminUser | null>(null)

  async function remove(user: AdminUser) {
    if (user.role === 'admin') return
    logAction('admin.user_delete.confirmation_opened')
    setDeleteUser(user)
  }

  async function confirmDeleteUser(user: AdminUser) {
    logAction('admin.user_delete.started')
    try { await refreshCsrf(); await api.delete(`/admin/users/${user.id}`); setUsers(old=>old.filter(u=>u.id!==user.id)); setDeleteUser(null); logAction('admin.user_delete.completed') }
    catch (e: any) { logAction('admin.user_delete.failed', { status: e.response?.status || 0 }); setError(e.response?.data?.error || 'Falha ao excluir usuário.') }
  }
  return <div className="app-shell"><header className="topbar"><div className="brand"><span className="brand-mark"><ShieldCheck/></span><span className="brand-name">Pixel Breeders <em>projeto camada</em></span></div><button className="ghost" onClick={onBack}><ArrowLeft size={17}/> Voltar aos arquivos</button></header>
    <main className="dashboard"><p className="eyebrow">CONTROLE DE ACESSO</p><h1>Administração</h1><p className="muted">Gerencie as contas cadastradas na plataforma.</p>
      <section className="files-section"><div className="section-heading"><div><h2><Users size={20}/> Usuários</h2><p className="muted">{users.length} contas cadastradas</p></div></div>{error && <div className="error">{error}</div>}
        <div className="file-list">{users.map(u=><article className="file-row" key={u.id}><div className="file-icon"><Users size={19}/></div><div className="file-info"><strong>{u.email}</strong><small>{u.role === 'admin' ? 'Administrador' : 'Usuário'} · {u.fileCount} arquivos</small></div><div className="file-actions">{u.role === 'admin' ? <span className="role-pill">Admin protegido</span> : <button className="icon-button danger-hover" data-tooltip="Excluir usuário" aria-label="Excluir usuário" onClick={()=>remove(u)}><Trash2 size={17}/></button>}</div></article>)}</div>
      </section>
      {deleteUser && <div className="confirm-overlay" onClick={() => setDeleteUser(null)}><div className="confirm-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="delete-user-title"><h3 id="delete-user-title">Excluir usuário?</h3><p>Deseja excluir <strong>{deleteUser.email}</strong> e todos os seus arquivos?</p><div className="confirm-actions"><button className="ghost" onClick={() => setDeleteUser(null)}>Cancelar</button><button className="primary" onClick={() => confirmDeleteUser(deleteUser)}>Sim</button></div></div></div>}
    </main></div>
}
