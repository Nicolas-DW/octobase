import { useState, useRef, useEffect, useCallback } from 'react'
import Canvas, { type CanvasHandle, type BackgroundType } from './components/Canvas'
import Sidebar from './components/Sidebar'
import { 
  getCurrentCanvas, 
  getCanvasById,
  updateCanvas, 
  createCanvas,
  migrateOldCanvasData,
  type CanvasData
} from './services/canvasManager'
import type { CanvasViewState } from './services/storage'
import './App.css'

export interface Shape {
  id: string
  type: 'square' | 'circle' | 'triangle' | 'text'
  x: number
  y: number
  width: number
  height: number
  color: string
  content?: string // Pour les blocs de texte (markdown)
}

function App() {
  const [shapes, setShapes] = useState<Shape[]>([])
  const [currentCanvas, setCurrentCanvas] = useState<CanvasData | null>(null)
  const [showShapeMenu, setShowShapeMenu] = useState(false)
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number; worldX: number; worldY: number } | null>(null)
  const [sidebarVisible, setSidebarVisible] = useState(true)
  const [backgroundType, setBackgroundType] = useState<BackgroundType>('grid')
  const [showBackgroundMenu, setShowBackgroundMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const contextMenuRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const backgroundMenuRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<CanvasHandle>(null)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isInitialLoadRef = useRef(true)
  const initialShapesPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map())

  // Fonction de sauvegarde avec debounce pour éviter trop de sauvegardes
  const saveState = useCallback((viewState?: CanvasViewState, bgType?: BackgroundType) => {
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
          backgroundType: bgType !== undefined ? bgType : backgroundType,
          shapes: shapes
        })
      }
    }, 500) // Debounce de 500ms
  }, [shapes, currentCanvas, backgroundType])

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

    // Restaurer le type de fond
    setBackgroundType(canvas.backgroundType || 'grid')

    // Restaurer la vue de la caméra avec un petit délai pour s'assurer que le canvas est monté
    setTimeout(() => {
      if (canvas.viewState && canvasRef.current) {
        // Si la vue sauvegardée est l'état par défaut (0,0,1), centrer à l'origine
        const isDefaultView = canvas.viewState.x === 0 && canvas.viewState.y === 0 && canvas.viewState.zoom === 1
        if (isDefaultView) {
          canvasRef.current.centerAtOrigin()
        } else {
          canvasRef.current.setViewState(canvas.viewState)
        }
      } else if (canvasRef.current) {
        // Pas de vue sauvegardée, centrer à l'origine
        canvasRef.current.centerAtOrigin()
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
        backgroundType: backgroundType,
        shapes: shapes
      })
    }
    
    // Charger la nouvelle toile
    loadCanvas(canvas)
  }, [currentCanvas, shapes, backgroundType, loadCanvas])

  // Sauvegarder automatiquement quand les formes changent
  useEffect(() => {
    saveState()
  }, [shapes, saveState])

  // Callback pour les changements de vue
  const handleViewStateChange = useCallback((viewState: CanvasViewState) => {
    saveState(viewState)
  }, [saveState])

  // Sauvegarder automatiquement quand le type de fond change
  useEffect(() => {
    if (!isInitialLoadRef.current && currentCanvas) {
      saveState(undefined, backgroundType)
    }
  }, [backgroundType, currentCanvas, saveState])

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
      if (
        showBackgroundMenu &&
        backgroundMenuRef.current &&
        !backgroundMenuRef.current.contains(event.target as Node)
      ) {
        setShowBackgroundMenu(false)
      }
    }

    if (showShapeMenu || contextMenuPos || showBackgroundMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [showShapeMenu, contextMenuPos, showBackgroundMenu])

  const addShape = (type: 'square' | 'circle' | 'triangle' | 'text', x?: number, y?: number) => {
    // Si aucune position spécifiée, placer l'objet au centre visible (qui correspond à 0,0)
    let shapeX = x
    let shapeY = y
    
    if (shapeX === undefined || shapeY === undefined) {
      const centerCoords = canvasRef.current?.getCenterWorldCoords()
      if (centerCoords) {
        // Centrer l'objet sur le point (0,0) en ajustant avec la moitié de sa taille
        shapeX = centerCoords.x - 50 // 50 = width/2
        shapeY = centerCoords.y - 50 // 50 = height/2
      } else {
        // Fallback si on ne peut pas obtenir le centre
        shapeX = -50
        shapeY = -50
      }
    }
    
    const newShape: Shape = {
      id: Date.now().toString(),
      type,
      x: shapeX,
      y: shapeY,
      width: type === 'text' ? 300 : 100,
      height: type === 'text' ? 150 : 100,
      color: type === 'text' ? '#ffffff' : `hsl(${Math.random() * 360}, 70%, 50%)`,
      content: type === 'text' ? '# Titre\n\nÉcrivez votre texte ici avec du **markdown**.' : undefined,
    }
    setShapes((prevShapes) => [...prevShapes, newShape])
    setShowShapeMenu(false)
    setContextMenuPos(null)
  }

  const handleCanvasContextMenu = (worldX: number, worldY: number, clientX: number, clientY: number) => {
    setContextMenuPos({ x: clientX, y: clientY, worldX, worldY })
  }

  const handleShapeMove = (shapeId: string, newX: number, newY: number) => {
    // Nettoyer les positions initiales lors du déplacement d'une seule forme
    initialShapesPositionsRef.current.clear()
    setShapes((prevShapes) =>
      prevShapes.map((shape) =>
        shape.id === shapeId ? { ...shape, x: newX, y: newY } : shape
      )
    )
    // La sauvegarde sera déclenchée automatiquement par le useEffect
  }

  const handleTextContentChange = useCallback((shapeId: string, content: string) => {
    setShapes((prevShapes) =>
      prevShapes.map((shape) =>
        shape.id === shapeId ? { ...shape, content } : shape
      )
    )
  }, [])

  const handleShapesMove = useCallback((shapeIds: string[], deltaX: number, deltaY: number) => {
    setShapes((prevShapes) => {
      // Si c'est le début du drag (delta très petit ou ref vide), stocker les positions initiales
      if ((Math.abs(deltaX) < 0.1 && Math.abs(deltaY) < 0.1) || initialShapesPositionsRef.current.size === 0) {
        // Nettoyer la ref et stocker les nouvelles positions initiales
        initialShapesPositionsRef.current.clear()
        prevShapes.forEach((shape) => {
          if (shapeIds.includes(shape.id)) {
            initialShapesPositionsRef.current.set(shape.id, { x: shape.x, y: shape.y })
          }
        })
      }

      return prevShapes.map((shape) => {
        if (shapeIds.includes(shape.id)) {
          // Utiliser les positions initiales stockées dans la ref pour éviter l'accumulation
          const initialPos = initialShapesPositionsRef.current.get(shape.id)
          if (initialPos) {
            return { ...shape, x: initialPos.x + deltaX, y: initialPos.y + deltaY }
          }
          // Fallback si la position initiale n'est pas trouvée
          return { ...shape, x: shape.x + deltaX, y: shape.y + deltaY }
        }
        return shape
      })
    })
    // La sauvegarde sera déclenchée automatiquement par le useEffect
  }, [])

  const toggleShapeMenu = () => {
    setShowShapeMenu(!showShapeMenu)
  }

  const handleHome = () => {
    canvasRef.current?.fitToView()
  }

  // Fonction pour exporter la toile actuelle
  const handleExportCanvas = useCallback(() => {
    if (!currentCanvas || !canvasRef.current) return

    const viewState = canvasRef.current.getViewState()
    const exportData = {
      name: currentCanvas.name,
      viewState,
      backgroundType: backgroundType,
      shapes: shapes,
      elements: currentCanvas.elements,
      createdAt: currentCanvas.createdAt,
      updatedAt: Date.now()
    }

    const json = JSON.stringify(exportData, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${currentCanvas.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }, [currentCanvas, backgroundType, shapes])

  // Fonction pour importer une toile
  const handleImportCanvas = useCallback((importedData: {
    name?: string
    viewState?: CanvasViewState
    backgroundType?: BackgroundType
    shapes?: Shape[]
    elements?: { shapes?: Shape[] }
    createdAt?: number
    updatedAt?: number
  }) => {
    // Extraire le nom du fichier si fourni, sinon utiliser le nom dans les données
    const canvasName = importedData.name || 'Toile importée'
    
    // Créer une nouvelle toile avec les données importées
    const newCanvas = createCanvas(canvasName)
    
    // Mettre à jour avec les données importées
    const importedShapes = importedData.shapes || importedData.elements?.shapes || []
    const importedViewState = importedData.viewState || { x: 0, y: 0, zoom: 1 }
    const importedBackgroundType = importedData.backgroundType || 'grid'
    
    updateCanvas(newCanvas.id, {
      viewState: importedViewState,
      backgroundType: importedBackgroundType,
      shapes: importedShapes
    })

    // Récupérer la toile mise à jour depuis le storage et la charger
    const updatedCanvas = getCanvasById(newCanvas.id)
    if (updatedCanvas) {
      handleCanvasSelect(updatedCanvas)
    } else {
      loadCanvas({
        ...newCanvas,
        viewState: importedViewState,
        backgroundType: importedBackgroundType,
        elements: {
          ...newCanvas.elements,
          shapes: importedShapes
        }
      })
    }
  }, [loadCanvas, handleCanvasSelect])

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  return (
    <div className="app">
      <Sidebar 
        onCanvasSelect={handleCanvasSelect} 
        onToggle={() => setSidebarVisible(false)}
        onExportCanvas={handleExportCanvas}
        onImportCanvas={handleImportCanvas}
        canExport={currentCanvas !== null}
        isHidden={!sidebarVisible}
      />
      <div className="app-main">
        <Canvas 
          ref={canvasRef} 
          shapes={shapes} 
          onContextMenu={handleCanvasContextMenu} 
          onShapeMove={handleShapeMove}
          onShapesMove={handleShapesMove}
          onViewStateChange={handleViewStateChange}
          onTextContentChange={handleTextContentChange}
          backgroundType={backgroundType}
        />
      {!sidebarVisible && (
        <button
          className="sidebar-tab sidebar-tab-hidden"
          onClick={() => setSidebarVisible(true)}
          title="Afficher la sidebar"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6"></polyline>
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
            <button
              className="shape-menu-item"
              onClick={() => addShape('text')}
              title="Bloc de texte"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 7h16M4 12h16M4 17h12" />
              </svg>
              <span>Bloc de texte</span>
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
          <button
            className="shape-menu-item"
            onClick={() => addShape('text', contextMenuPos.worldX - 150, contextMenuPos.worldY - 75)}
            title="Bloc de texte"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 7h16M4 12h16M4 17h12" />
            </svg>
            <span>Bloc de texte</span>
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
      
      <div className="background-selector-container" ref={backgroundMenuRef}>
        <button
          className="background-selector-button"
          onClick={() => setShowBackgroundMenu(!showBackgroundMenu)}
          title="Choisir le type de fond"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="9" y1="3" x2="9" y2="21"></line>
            <line x1="3" y1="9" x2="21" y2="9"></line>
          </svg>
        </button>
        {showBackgroundMenu && (
          <div className="background-menu">
            <button
              className={`background-menu-item ${backgroundType === 'grid' ? 'active' : ''}`}
              onClick={() => {
                setBackgroundType('grid')
                setShowBackgroundMenu(false)
                // La sauvegarde sera déclenchée automatiquement par le useEffect
              }}
              title="Grille normale"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="9" y1="3" x2="9" y2="21"></line>
                <line x1="3" y1="9" x2="21" y2="9"></line>
              </svg>
              <span>Grille normale</span>
            </button>
            <button
              className={`background-menu-item ${backgroundType === 'radar' ? 'active' : ''}`}
              onClick={() => {
                setBackgroundType('radar')
                setShowBackgroundMenu(false)
                // La sauvegarde sera déclenchée automatiquement par le useEffect
              }}
              title="Grille radar"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="2" x2="12" y2="22"></line>
                <line x1="2" y1="12" x2="22" y2="12"></line>
                <line x1="12" y1="2" x2="16" y2="8"></line>
                <line x1="12" y1="2" x2="8" y2="8"></line>
              </svg>
              <span>Grille radar</span>
            </button>
            <button
              className={`background-menu-item ${backgroundType === 'dots' ? 'active' : ''}`}
              onClick={() => {
                setBackgroundType('dots')
                setShowBackgroundMenu(false)
                // La sauvegarde sera déclenchée automatiquement par le useEffect
              }}
              title="Points"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="6" cy="6" r="2"></circle>
                <circle cx="12" cy="6" r="2"></circle>
                <circle cx="18" cy="6" r="2"></circle>
                <circle cx="6" cy="12" r="2"></circle>
                <circle cx="12" cy="12" r="2"></circle>
                <circle cx="18" cy="12" r="2"></circle>
                <circle cx="6" cy="18" r="2"></circle>
                <circle cx="12" cy="18" r="2"></circle>
                <circle cx="18" cy="18" r="2"></circle>
              </svg>
              <span>Points</span>
            </button>
            <button
              className={`background-menu-item ${backgroundType === 'diagonal' ? 'active' : ''}`}
              onClick={() => {
                setBackgroundType('diagonal')
                setShowBackgroundMenu(false)
                // La sauvegarde sera déclenchée automatiquement par le useEffect
              }}
              title="Lignes diagonales"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="3" x2="21" y2="21"></line>
                <line x1="21" y1="3" x2="3" y2="21"></line>
                <line x1="12" y1="3" x2="21" y2="12"></line>
                <line x1="3" y1="12" x2="12" y2="21"></line>
              </svg>
              <span>Diagonales</span>
            </button>
            <button
              className={`background-menu-item ${backgroundType === 'graph' ? 'active' : ''}`}
              onClick={() => {
                setBackgroundType('graph')
                setShowBackgroundMenu(false)
                // La sauvegarde sera déclenchée automatiquement par le useEffect
              }}
              title="Papier quadrillé"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="6" y1="3" x2="6" y2="21"></line>
                <line x1="12" y1="3" x2="12" y2="21"></line>
                <line x1="18" y1="3" x2="18" y2="21"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
              <span>Quadrillé</span>
            </button>
            <button
              className={`background-menu-item ${backgroundType === 'isometric' ? 'active' : ''}`}
              onClick={() => {
                setBackgroundType('isometric')
                setShowBackgroundMenu(false)
                // La sauvegarde sera déclenchée automatiquement par le useEffect
              }}
              title="Grille isométrique"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 21l9-9 9 9"></path>
                <path d="M12 3v18"></path>
                <path d="M3 12h18"></path>
                <path d="M3 3l9 9"></path>
              </svg>
              <span>Isométrique</span>
            </button>
          </div>
        )}
      </div>
      </div>
    </div>
  )
}

export default App

