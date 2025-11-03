import { useState, useRef, useEffect, useCallback } from 'react'
import Canvas, { type CanvasHandle } from './components/Canvas'
import Sidebar from './components/Sidebar'
import { 
  getCurrentCanvas, 
  updateCanvas, 
  createCanvas,
  migrateOldCanvasData,
  type CanvasData
} from './services/canvasManager'
import type { CanvasViewState } from './services/storage'
import './App.css'

export interface Shape {
  id: string
  type: 'square' | 'circle' | 'triangle'
  x: number
  y: number
  width: number
  height: number
  color: string
}

function App() {
  const [shapes, setShapes] = useState<Shape[]>([])
  const [currentCanvas, setCurrentCanvas] = useState<CanvasData | null>(null)
  const [showShapeMenu, setShowShapeMenu] = useState(false)
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number; worldX: number; worldY: number } | null>(null)
  const [sidebarVisible, setSidebarVisible] = useState(true)
  const menuRef = useRef<HTMLDivElement>(null)
  const contextMenuRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const canvasRef = useRef<CanvasHandle>(null)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isInitialLoadRef = useRef(true)

  // Fonction de sauvegarde avec debounce pour éviter trop de sauvegardes
  const saveState = useCallback((viewState?: CanvasViewState) => {
    // Ne pas sauvegarder pendant le chargement initial ou si aucune toile n'est sélectionnée
    if (isInitialLoadRef.current || !currentCanvas) return

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(() => {
      const currentViewState = viewState || (canvasRef.current ? canvasRef.current.getViewState() : null)
      if (currentViewState && currentCanvas) {
        updateCanvas(currentCanvas.id, {
          viewState: currentViewState,
          shapes: shapes
        })
      }
    }, 500) // Debounce de 500ms
  }, [shapes, currentCanvas])

  // Migration des anciennes données au premier démarrage
  useEffect(() => {
    migrateOldCanvasData()
    
    // Charger la toile courante
    const canvas = getCurrentCanvas()
    if (canvas) {
      loadCanvas(canvas)
    } else {
      // Aucune toile existante, créer une première toile
      const newCanvas = createCanvas('Ma première toile')
      loadCanvas(newCanvas)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fonction pour charger une toile
  const loadCanvas = useCallback((canvas: CanvasData) => {
    isInitialLoadRef.current = true
    setCurrentCanvas(canvas)
    
    // Restaurer les formes
    if (canvas.elements.shapes && Array.isArray(canvas.elements.shapes)) {
      setShapes(canvas.elements.shapes as Shape[])
    } else {
      setShapes([])
    }

    // Restaurer la vue de la caméra avec un petit délai pour s'assurer que le canvas est monté
    setTimeout(() => {
      if (canvas.viewState && canvasRef.current) {
        canvasRef.current.setViewState(canvas.viewState)
      }
      // Marquer le chargement initial comme terminé après restauration
      setTimeout(() => {
        isInitialLoadRef.current = false
      }, 500)
    }, 100)
  }, [])

  // Callback pour sélectionner une toile depuis le Sidebar
  const handleCanvasSelect = useCallback((canvas: CanvasData) => {
    // Sauvegarder la toile actuelle avant de changer
    if (currentCanvas && canvasRef.current) {
      const viewState = canvasRef.current.getViewState()
      updateCanvas(currentCanvas.id, {
        viewState: viewState,
        shapes: shapes
      })
    }
    
    // Charger la nouvelle toile
    loadCanvas(canvas)
  }, [currentCanvas, shapes, loadCanvas])

  // Sauvegarder automatiquement quand les formes changent
  useEffect(() => {
    saveState()
  }, [shapes, saveState])

  // Callback pour les changements de vue
  const handleViewStateChange = useCallback((viewState: CanvasViewState) => {
    saveState(viewState)
  }, [saveState])

  // Fermer le menu si on clique en dehors
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setShowShapeMenu(false)
      }
      if (
        contextMenuRef.current &&
        !contextMenuRef.current.contains(event.target as Node)
      ) {
        setContextMenuPos(null)
      }
    }

    if (showShapeMenu || contextMenuPos) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [showShapeMenu, contextMenuPos])

  const addShape = (type: 'square' | 'circle' | 'triangle', x?: number, y?: number) => {
    const newShape: Shape = {
      id: Date.now().toString(),
      type,
      x: x ?? 0,
      y: y ?? 0,
      width: 100,
      height: 100,
      color: `hsl(${Math.random() * 360}, 70%, 50%)`,
    }
    setShapes([...shapes, newShape])
    setShowShapeMenu(false)
    setContextMenuPos(null)
  }

  const handleCanvasContextMenu = (worldX: number, worldY: number, clientX: number, clientY: number) => {
    setContextMenuPos({ x: clientX, y: clientY, worldX, worldY })
  }

  const handleShapeMove = (shapeId: string, newX: number, newY: number) => {
    setShapes((prevShapes) =>
      prevShapes.map((shape) =>
        shape.id === shapeId ? { ...shape, x: newX, y: newY } : shape
      )
    )
    // La sauvegarde sera déclenchée automatiquement par le useEffect
  }

  const toggleShapeMenu = () => {
    setShowShapeMenu(!showShapeMenu)
  }

  const handleHome = () => {
    canvasRef.current?.fitToView()
  }

  return (
    <div className="app">
      {sidebarVisible && <Sidebar onCanvasSelect={handleCanvasSelect} onToggle={() => setSidebarVisible(false)} />}
      <div className={`app-main ${sidebarVisible ? '' : 'app-main-full'}`}>
        <Canvas 
          ref={canvasRef} 
          shapes={shapes} 
          onContextMenu={handleCanvasContextMenu} 
          onShapeMove={handleShapeMove}
          onViewStateChange={handleViewStateChange}
        />
      {!sidebarVisible && (
        <button
          className="sidebar-toggle-button"
          onClick={() => setSidebarVisible(true)}
          title="Afficher la sidebar"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>
      )}
      <div className="add-button-container">
        <button
          ref={buttonRef}
          className="add-button"
          onClick={toggleShapeMenu}
          title="Ajouter une forme"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>
        {showShapeMenu && (
          <div ref={menuRef} className="shape-menu">
            <button
              className="shape-menu-item"
              onClick={() => addShape('square')}
              title="Carré"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <rect x="2" y="2" width="16" height="16" rx="1" />
              </svg>
              <span>Carré</span>
            </button>
            <button
              className="shape-menu-item"
              onClick={() => addShape('circle')}
              title="Cercle"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <circle cx="10" cy="10" r="8" />
              </svg>
              <span>Cercle</span>
            </button>
            <button
              className="shape-menu-item"
              onClick={() => addShape('triangle')}
              title="Triangle"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 2 L18 16 L2 16 Z" />
              </svg>
              <span>Triangle</span>
            </button>
          </div>
        )}
      </div>
      {contextMenuPos && (
        <div
          ref={contextMenuRef}
          className="context-menu"
          style={{
            left: `${contextMenuPos.x}px`,
            top: `${contextMenuPos.y}px`,
          }}
        >
          <button
            className="shape-menu-item"
            onClick={() => addShape('square', contextMenuPos.worldX - 50, contextMenuPos.worldY - 50)}
            title="Carré"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <rect x="2" y="2" width="16" height="16" rx="1" />
            </svg>
            <span>Carré</span>
          </button>
          <button
            className="shape-menu-item"
            onClick={() => addShape('circle', contextMenuPos.worldX - 50, contextMenuPos.worldY - 50)}
            title="Cercle"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <circle cx="10" cy="10" r="8" />
            </svg>
            <span>Cercle</span>
          </button>
          <button
            className="shape-menu-item"
            onClick={() => addShape('triangle', contextMenuPos.worldX - 50, contextMenuPos.worldY - 50)}
            title="Triangle"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 2 L18 16 L2 16 Z" />
            </svg>
            <span>Triangle</span>
          </button>
        </div>
      )}
      <button
        className="home-button"
        onClick={handleHome}
        title="Recentrer la vue sur toutes les formes"
        disabled={shapes.length === 0}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
          <polyline points="9 22 9 12 15 12 15 22"></polyline>
        </svg>
      </button>
      </div>
    </div>
  )
}

export default App

