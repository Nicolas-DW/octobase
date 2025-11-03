import { useState, useEffect } from 'react'
import { 
  getAllCanvases, 
  createCanvas, 
  deleteCanvas, 
  sortCanvases,
  getCurrentCanvasId,
  setCurrentCanvasId as setCurrentCanvasIdStorage,
  type CanvasData,
  type SortOption
} from '../services/canvasManager'
import './Sidebar.css'

interface SidebarProps {
  onCanvasSelect: (canvas: CanvasData) => void
  onToggle?: () => void
}

export default function Sidebar({ onCanvasSelect, onToggle }: SidebarProps) {
  const [canvases, setCanvases] = useState<CanvasData[]>([])
  const [sortBy, setSortBy] = useState<SortOption>('createdAt')
  const [isCreating, setIsCreating] = useState(false)
  const [newCanvasName, setNewCanvasName] = useState('')
  const [currentCanvasId, setCurrentCanvasId] = useState<string | null>(getCurrentCanvasId())

  // Charger les toiles et écouter les changements
  const loadCanvases = () => {
    const allCanvases = getAllCanvases()
    const sorted = sortCanvases(allCanvases, sortBy)
    setCanvases(sorted)
    // Mettre à jour l'ID de la toile courante
    setCurrentCanvasId(getCurrentCanvasId())
  }

  useEffect(() => {
    loadCanvases()
    
    // Écouter les changements dans localStorage (pour la synchronisation entre onglets)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'octobase-canvases' || e.key === 'octobase-current-canvas-id') {
        loadCanvases()
      }
    }
    
    window.addEventListener('storage', handleStorageChange)
    
    // Polling périodique pour détecter les changements (si nécessaire)
    const interval = setInterval(loadCanvases, 500)
    
    return () => {
      window.removeEventListener('storage', handleStorageChange)
      clearInterval(interval)
    }
  }, [sortBy])

  const handleCreateCanvas = () => {
    if (newCanvasName.trim()) {
      const newCanvas = createCanvas(newCanvasName.trim())
      loadCanvases()
      onCanvasSelect(newCanvas)
      setNewCanvasName('')
      setIsCreating(false)
    } else {
      // Créer avec un nom par défaut
      const newCanvas = createCanvas()
      loadCanvases()
      onCanvasSelect(newCanvas)
      setIsCreating(false)
    }
  }

  const handleDeleteCanvas = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cette toile ?')) {
      deleteCanvas(id)
      loadCanvases()
      
      // Si on a supprimé la toile courante, charger la première disponible ou créer une nouvelle
      const remaining = getAllCanvases()
      if (remaining.length > 0) {
        const sorted = sortCanvases(remaining, sortBy)
        onCanvasSelect(sorted[0])
      } else {
        // Aucune toile restante, créer une nouvelle
        const newCanvas = createCanvas()
        onCanvasSelect(newCanvas)
      }
    }
  }

  const handleSelectCanvas = (canvas: CanvasData) => {
    setCurrentCanvasIdStorage(canvas.id)
    onCanvasSelect(canvas)
  }

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    
    if (days === 0) {
      return 'Aujourd\'hui'
    } else if (days === 1) {
      return 'Hier'
    } else if (days < 7) {
      return `Il y a ${days} jours`
    } else {
      return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
    }
  }

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2 className="sidebar-title">Toiles</h2>
        <div className="sidebar-header-actions">
          <button
            className="sidebar-create-button"
            onClick={() => setIsCreating(true)}
            title="Créer une nouvelle toile"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
          {onToggle && (
            <button
              className="sidebar-toggle-button"
              onClick={onToggle}
              title="Masquer la sidebar"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          )}
        </div>
      </div>

      {isCreating && (
        <div className="sidebar-create-form">
          <input
            type="text"
            value={newCanvasName}
            onChange={(e) => setNewCanvasName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleCreateCanvas()
              } else if (e.key === 'Escape') {
                setIsCreating(false)
                setNewCanvasName('')
              }
            }}
            placeholder="Nom de la toile"
            autoFocus
            className="sidebar-input"
          />
          <div className="sidebar-create-actions">
            <button
              className="sidebar-button sidebar-button-primary"
              onClick={handleCreateCanvas}
            >
              Créer
            </button>
            <button
              className="sidebar-button"
              onClick={() => {
                setIsCreating(false)
                setNewCanvasName('')
              }}
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      <div className="sidebar-sort">
        <label className="sidebar-sort-label">Trier par :</label>
        <div className="sidebar-sort-buttons">
          <button
            className={`sidebar-sort-button ${sortBy === 'name' ? 'active' : ''}`}
            onClick={() => setSortBy('name')}
            title="A-Z"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="8" y1="6" x2="18" y2="6"></line>
              <line x1="8" y1="12" x2="18" y2="12"></line>
              <line x1="8" y1="18" x2="16" y2="18"></line>
              <line x1="6" y1="6" x2="6" y2="18"></line>
              <polyline points="10 10 12 8 14 10"></polyline>
            </svg>
          </button>
          <button
            className={`sidebar-sort-button ${sortBy === 'nameDesc' ? 'active' : ''}`}
            onClick={() => setSortBy('nameDesc')}
            title="Z-A"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="8" y1="6" x2="18" y2="6"></line>
              <line x1="8" y1="12" x2="18" y2="12"></line>
              <line x1="8" y1="18" x2="16" y2="18"></line>
              <line x1="6" y1="6" x2="6" y2="18"></line>
              <polyline points="10 14 12 16 14 14"></polyline>
            </svg>
          </button>
          <button
            className={`sidebar-sort-button ${sortBy === 'createdAt' ? 'active' : ''}`}
            onClick={() => setSortBy('createdAt')}
            title="Position d'origine"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </button>
        </div>
      </div>

      <div className="sidebar-list">
        {canvases.length === 0 ? (
          <div className="sidebar-empty">
            <p>Aucune toile disponible</p>
            <button
              className="sidebar-button sidebar-button-primary"
              onClick={() => {
                const newCanvas = createCanvas()
                loadCanvases()
                onCanvasSelect(newCanvas)
              }}
            >
              Créer une toile
            </button>
          </div>
        ) : (
          canvases.map((canvas) => (
            <div
              key={canvas.id}
              className={`sidebar-item ${currentCanvasId === canvas.id ? 'sidebar-item-active' : ''}`}
              onClick={() => handleSelectCanvas(canvas)}
            >
              <div className="sidebar-item-content">
                <div className="sidebar-item-name">{canvas.name}</div>
                <div className="sidebar-item-meta">
                  {formatDate(canvas.updatedAt)}
                </div>
              </div>
              <button
                className="sidebar-item-delete"
                onClick={(e) => handleDeleteCanvas(canvas.id, e)}
                title="Supprimer la toile"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

