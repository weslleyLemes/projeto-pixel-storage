import { useEffect, useRef, useState } from 'react'
import { api, logAction, refreshCsrf } from './api'
import type { User } from './App'
import { CloudUpload, FileText, Image, File, Download, Trash2, LogOut, Shield, Plus, Search, Eye, X, PencilLine, Link2, Check } from 'lucide-react'

type StoredFile = { id: string; name: string; mimeType: string; size: number; createdAt: string }
const prettySize = (n: number) => n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 / 1024).toFixed(2)} MB`

export function Dashboard({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [files, setFiles] = useState<StoredFile[]>([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [busy, setBusy] = useState(false)
  const [query, setQuery] = useState('')
  const [previewItem, setPreviewItem] = useState<StoredFile | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewText, setPreviewText] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const [versionPrompt, setVersionPrompt] = useState<{ item: StoredFile; name: string } | null>(null)
  const [deletePrompt, setDeletePrompt] = useState<StoredFile | null>(null)
  const [uploadState, setUploadState] = useState({ active: false, percent: 0, label: '' })
  const [downloadState, setDownloadState] = useState({ active: false, percent: 0, label: '' })
  const picker = useRef<HTMLInputElement>(null)

  async function loadFiles() { const { data } = await api.get('/files'); setFiles(data.files) }
  useEffect(() => { loadFiles().catch(() => setError('Não foi possível carregar seus arquivos.')) }, [])

  async function upload(file?: File) {
    if (!file) return
    logAction('file.upload.started', { sizeBytes: file.size })
    setError(''); setBusy(true)
    const isSmallFile = file.size <= 2 * 1024 * 1024

    try {
      await refreshCsrf()
      setUploadState({ active: true, percent: 0, label: isSmallFile ? 'Preparando upload...' : 'Enviando arquivo...' })

      if (isSmallFile) {
        const steps = [12, 28, 46, 67, 82, 100]
        for (const percent of steps) {
          setUploadState({ active: true, percent, label: percent < 100 ? 'Enviando arquivo...' : 'Finalizando upload...' })
          await new Promise(resolve => setTimeout(resolve, 170))
        }
      }

      const body = new FormData(); body.append('file', file)
      await api.post('/files', body, {
        onUploadProgress: (event) => {
          if (!event.total || isSmallFile) return
          const percent = Math.min(100, Math.round((event.loaded / event.total) * 100))
          setUploadState({ active: true, percent, label: percent < 100 ? 'Transferindo arquivo...' : 'Finalizando upload...' })
        },
      })

      await loadFiles()
      setUploadState({ active: true, percent: 100, label: 'Upload concluído' })
      logAction('file.upload.completed', { sizeBytes: file.size })
    } catch (e: any) { logAction('file.upload.failed', { status: e.response?.status || 0 }); setError(e.response?.data?.error || 'Falha no upload.') }
    finally {
      setBusy(false)
      if (picker.current) picker.current.value = ''
      setTimeout(() => setUploadState({ active: false, percent: 0, label: '' }), 700)
    }
  }
  async function remove(item: StoredFile) {
    logAction('file.delete.confirmation_opened')
    setDeletePrompt(item)
  }

  async function confirmDelete(item: StoredFile) {
    logAction('file.delete.started')
    try { await refreshCsrf(); await api.delete(`/files/${item.id}`); setFiles(old => old.filter(f => f.id !== item.id)); setDeletePrompt(null); logAction('file.delete.completed') }
    catch (e: any) { logAction('file.delete.failed', { status: e.response?.status || 0 }); setError(e.response?.data?.error || 'Falha ao excluir arquivo.') }
  }
  async function copyShareLink(item: StoredFile) {
    logAction('file.share_link.started')
    try {
      await refreshCsrf()
      const { data } = await api.post(`/files/${item.id}/share`, { expiresInMinutes: 60 })
      await navigator.clipboard.writeText(new URL(data.url, window.location.origin).toString())
      setError('')
      setSuccess('Link temporário copiado para a área de transferência.')
      logAction('file.share_link.copied')
    } catch (e: any) {
      logAction('file.share_link.failed', { status: e.response?.status || 0 })
      setSuccess('')
      setError(e.response?.data?.error || 'Não foi possível criar o link temporário.')
    }
  }

  async function download(item: StoredFile) {
    logAction('file.download.started')
    try {
      setDownloadState({ active: true, percent: 0, label: 'Preparando download...' })
      const response = await api.get(`/files/${item.id}/download`, {
        responseType: 'blob',
        onDownloadProgress: (event) => {
          if (!event.total) return
          const percent = Math.min(100, Math.round((event.loaded / event.total) * 100))
          setDownloadState({ active: true, percent, label: percent < 100 ? 'Baixando arquivo...' : 'Finalizando download...' })
        },
      })
      const url = URL.createObjectURL(response.data); const a = document.createElement('a')
      a.href = url; a.download = item.name; a.click(); URL.revokeObjectURL(url)
      setDownloadState({ active: true, percent: 100, label: 'Download concluído' })
      logAction('file.download.completed')
    } catch (e: any) { logAction('file.download.failed', { status: e.response?.status || 0 }); setError('Não foi possível baixar o arquivo.') }
    finally { setTimeout(() => setDownloadState({ active: false, percent: 0, label: '' }), 700) }
  }

  async function preview(item: StoredFile) {
    logAction('file.preview.opened')
    setError('')
    setPreviewText('')
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setPreviewItem(item)

    try {
      const response = await api.get(`/files/${item.id}/download`, { responseType: 'blob' })
      const blob = response.data
      const mime = blob.type || item.mimeType || ''
      if (mime.startsWith('text/') || item.name.toLowerCase().endsWith('.txt')) {
        const text = await blob.text()
        setPreviewText(text)
        setPreviewUrl(null)
        return
      }
      const fileUrl = URL.createObjectURL(blob)
      setPreviewUrl(fileUrl)
    } catch {
      logAction('file.preview.failed')
      setPreviewItem(null)
      setError('Não foi possível abrir a pré-visualização deste arquivo.')
    }
  }

  function closePreview() {
    logAction('file.preview.closed')
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setPreviewText('')
    setPreviewItem(null)
  }

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  async function saveVersion(item: StoredFile) {
    logAction('file.version.confirmation_opened')
    const name = draftName.trim()
    if (!name) {
      setError('Informe um nome válido para o arquivo.')
      return
    }
    setVersionPrompt({ item, name })
    setError('')
  }

  async function confirmVersion(keepPrevious: boolean) {
    if (!versionPrompt) return
    logAction('file.version.save_started', { keepPrevious })
    const { item, name } = versionPrompt

    try {
      await refreshCsrf()
      const { data } = await api.patch(`/files/${item.id}`, { name, keepPrevious })
      if (keepPrevious) {
        setFiles(old => [data.file, ...old])
      } else {
        setFiles(old => old.map(file => file.id === item.id ? { ...file, name: data.file.name } : file))
      }
      setEditingId(null)
      setDraftName('')
      setVersionPrompt(null)
      setError('')
      logAction('file.version.save_completed', { keepPrevious })
    } catch (e: any) {
      logAction('file.version.save_failed', { status: e.response?.status || 0 })
      setError(e.response?.data?.error || 'Não foi possível salvar a nova versão.')
    }
  }

  function startEdition(item: StoredFile) {
    setEditingId(item.id)
    setDraftName(item.name)
    setVersionPrompt(null)
    setError('')
  }

  const visible = files.filter(f => f.name.toLowerCase().includes(query.toLowerCase()))
  const FileIcon = (name: string) => name.toLowerCase().endsWith('.png') || name.toLowerCase().endsWith('.jpg') || name.toLowerCase().endsWith('.jpeg') || name.toLowerCase().endsWith('.pdf') || name.toLowerCase().endsWith('.txt') ? Image : FileText
  const formatSummary = ['png', 'jpg', 'pdf', 'txt'].filter((ext, index, arr) => files.some(f => f.name.toLowerCase().endsWith(ext)) && arr.indexOf(ext) === index).join(' · ') || 'sem arquivos'

  return <div className="app-shell"><header className="topbar"><div className="brand"><span className="brand-mark"><CloudUpload size={21}/></span><span className="brand-name">Pixel Breeders <em>projeto camada</em></span></div><div className="top-actions">{user.role === 'admin' && <><button className="ghost" onClick={() => location.href='/admin'}><Shield size={16}/> Administração</button><a className="ghost" href="/api/docs/" target="_blank" rel="noreferrer">Documentação da API</a></>}<span className="user-email">{user.email}</span><button className="icon-button" data-tooltip="Sair" aria-label="Sair" onClick={onLogout}><LogOut size={18}/></button></div></header>
    <main className="dashboard"><div className="welcome-row"><div><p className="eyebrow">SEU ESPAÇO</p><h1>Meus arquivos</h1><p className="muted">Tudo organizado, sempre ao seu alcance.</p></div><button className="primary" onClick={() => picker.current?.click()}><Plus size={18}/> Enviar arquivo</button></div>
      <div className="stats"><div className="stat-card"><span>ARQUIVOS</span><strong>{files.length}</strong><small>itens armazenados</small></div><div className="stat-card"><span>ESPAÇO UTILIZADO</span><strong>{prettySize(files.reduce((s,f)=>s+f.size,0))}</strong><small>Máx. 10MB · tipos: .png, .jpg, .pdf, .txt</small></div><div className="stat-card accent-stat"><span>FORMATOS</span><strong>{formatSummary === 'sem arquivos' ? 0 : formatSummary.split(' · ').length}</strong><small>{formatSummary === 'sem arquivos' ? 'sem arquivos' : formatSummary}</small></div></div>
      <section className="files-section"><div className="section-heading"><div><h2>Biblioteca</h2><p className="muted">{files.length} {files.length === 1 ? 'arquivo' : 'arquivos'}</p></div><div className="search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar arquivo"/></div></div>
        <input ref={picker} type="file" hidden accept=".png,.jpg,.jpeg,.pdf,.txt" onChange={e=>upload(e.target.files?.[0])}/>
        {(uploadState.active || downloadState.active) && <div className="transfer-status"><div className="transfer-header"><span>{uploadState.active ? 'Upload' : 'Download'}</span><strong>{uploadState.active ? uploadState.label : downloadState.label}</strong></div><div className="progress-track"><span style={{ width: `${uploadState.active ? uploadState.percent : downloadState.percent}%` }} /></div><small>{uploadState.active ? `${uploadState.percent}%` : `${downloadState.percent}%`}</small></div>}
        {error && <div className="error">{error}</div>}
        {success && <div className="success" role="status">{success}</div>}
        {files.length === 0 ? <div className="empty"><div className="empty-icon"><CloudUpload size={30}/></div><h3>Sua biblioteca começa aqui</h3><p>Envie seu primeiro arquivo para encontrá-lo sempre que precisar.</p><button className="primary" onClick={()=>picker.current?.click()} disabled={busy}><CloudUpload size={17}/>{busy ? 'Enviando...' : 'Escolher arquivo'}</button><small>Máx. 10MB · tipos: .png, .jpg, .pdf, .txt</small></div> :
          <div className="file-list file-list-scroll">{visible.map(item => { const Icon = FileIcon(item.name); const isEditing = editingId === item.id; return <article className="file-row" key={item.id}><div className="file-icon"><Icon size={20}/></div><div className="file-info"><div className="file-name-row">{isEditing ? <input className="file-name-input" value={draftName} onChange={e => setDraftName(e.target.value)} /> : <strong>{item.name}</strong>}</div><small>{prettySize(item.size)} · {new Date(item.createdAt).toLocaleDateString('pt-BR')}</small></div><div className="file-actions">{isEditing ? <><button className="icon-button" data-tooltip="Salvar versão" aria-label="Salvar versão" onClick={() => saveVersion(item)}><Check size={17}/></button><button className="icon-button" data-tooltip="Cancelar edição" aria-label="Cancelar edição" onClick={() => { setEditingId(null); setDraftName('') }}><X size={17}/></button></> : <><button className="icon-button" data-tooltip="Versionar arquivo" aria-label="Versionar arquivo" onClick={() => startEdition(item)}><PencilLine size={17}/></button><button className="icon-button" data-tooltip="Preview" aria-label="Preview" onClick={()=>preview(item)}><Eye size={17}/></button><button className="icon-button" data-tooltip="Copiar link temporário" aria-label="Copiar link temporário" onClick={()=>copyShareLink(item)}><Link2 size={17}/></button><button className="icon-button" data-tooltip="Baixar" aria-label="Baixar" onClick={()=>download(item)}><Download size={17}/></button><button className="icon-button danger-hover" data-tooltip="Excluir" aria-label="Excluir" onClick={()=>remove(item)}><Trash2 size={17}/></button></>}</div></article> })}{visible.length === 0 && <p className="muted">Nenhum arquivo encontrado para essa busca.</p>}</div>}
      </section>
    </main>
    {versionPrompt && <div className="confirm-overlay" onClick={() => setVersionPrompt(null)}><div className="confirm-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="version-title"><h3 id="version-title">Manter arquivo anterior?</h3><p>Deseja manter o arquivo anterior e criar uma nova versão?</p><div className="confirm-actions"><button className="ghost" onClick={() => confirmVersion(false)}>Não</button><button className="primary" onClick={() => confirmVersion(true)}>Sim</button></div></div></div>}
    {deletePrompt && <div className="confirm-overlay" onClick={() => setDeletePrompt(null)}><div className="confirm-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="delete-title"><h3 id="delete-title">Excluir arquivo?</h3><p>Deseja excluir permanentemente <strong>{deletePrompt.name}</strong>?</p><div className="confirm-actions"><button className="ghost" onClick={() => setDeletePrompt(null)}>Cancelar</button><button className="primary" onClick={() => confirmDelete(deletePrompt)}>Sim</button></div></div></div>}
    {previewItem && <div className="preview-overlay" onClick={closePreview}><div className="preview-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="preview-title"><button className="preview-close" data-tooltip="Fechar pré-visualização" aria-label="Fechar pré-visualização" onClick={closePreview}><X size={18}/></button><div className="preview-header"><h3 id="preview-title">{previewItem.name}</h3><button className="ghost" onClick={()=>download(previewItem)}><Download size={16}/> Baixar</button></div><div className="preview-body">{previewUrl ? (previewItem.mimeType === 'application/pdf' || previewItem.name.toLowerCase().endsWith('.pdf') ? <iframe className="preview-iframe" src={previewUrl} title={previewItem.name}/> : <img className="preview-image" src={previewUrl} alt={previewItem.name}/>) : (previewText ? <pre className="preview-text">{previewText}</pre> : <div className="preview-empty">Nenhuma pré-visualização disponível para este tipo de arquivo.</div>)}</div></div></div>}
  </div>
}
