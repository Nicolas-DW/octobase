import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react'
import type { Shape } from '../App'
import './Canvas.css'

export type BackgroundType = 'grid' | 'radar' | 'dots' | 'diagonal' | 'graph' | 'isometric'
export type CanvasMode = 'pan' | 'select'

interface CanvasProps {
  shapes: Shape[]
  onContextMenu?: (worldX: number, worldY: number, clientX: number, clientY: number) => void
  onShapeMove?: (shapeId: string, newX: number, newY: number) => void
  onShapesMove?: (shapeIds: string[], deltaX: number, deltaY: number) => void
  onViewStateChange?: (viewState: ViewState) => void
  backgroundType?: BackgroundType
}

interface ViewState {
  x: number
  y: number
  zoom: number
}

export interface CanvasHandle {
  fitToView: () => void
  setViewState: (viewState: { x: number; y: number; zoom: number }) => void
  getViewState: () => { x: number; y: number; zoom: number }
  getCenterWorldCoords: () => { x: number; y: number } | null
  centerAtOrigin: () => void
}

const Canvas = forwardRef<CanvasHandle, CanvasProps>(({ shapes, onContextMenu, onShapeMove, onShapesMove, onViewStateChange, backgroundType = 'grid' }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [viewState, setViewState] = useState<ViewState>({ x: 0, y: 0, zoom: 1 })
  const [isPanning, setIsPanning] = useState(false)
  const [lastPanPoint, setLastPanPoint] = useState({ x: 0, y: 0 })
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null)
  const [selectedShapeIds, setSelectedShapeIds] = useState<Set<string>>(new Set())
  const [isDraggingShape, setIsDraggingShape] = useState(false)
  const [isDraggingMultipleShapes, setIsDraggingMultipleShapes] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [initialShapesPositions, setInitialShapesPositions] = useState<Map<string, { x: number; y: number }>>(new Map())
  const [dragStartMousePos, setDragStartMousePos] = useState<{ worldX: number; worldY: number } | null>(null)
  const [isSelecting, setIsSelecting] = useState(false)
  const [selectionRect, setSelectionRect] = useState<{ startX: number; startY: number; endX: number; endY: number } | null>(null)
  const [selectionStartPoint, setSelectionStartPoint] = useState({ x: 0, y: 0 })
  const [isSpacePressed, setIsSpacePressed] = useState(false)
  const [canvasMode, setCanvasMode] = useState<CanvasMode>('pan')
  const lastTouchDistanceRef = useRef<number | null>(null)
  const panStartRef = useRef({ x: 0, y: 0 })
  const hasMovedRef = useRef(false)

  // Fonction pour détecter si un point est dans une forme
  const isPointInShape = (worldX: number, worldY: number, shape: Shape): boolean => {
    if (shape.type === 'square') {
      return (
        worldX >= shape.x &&
        worldX <= shape.x + shape.width &&
        worldY >= shape.y &&
        worldY <= shape.y + shape.height
      )
    } else if (shape.type === 'circle') {
      const centerX = shape.x + shape.width / 2
      const centerY = shape.y + shape.height / 2
      const radius = Math.min(shape.width, shape.height) / 2
      const distance = Math.sqrt(
        Math.pow(worldX - centerX, 2) + Math.pow(worldY - centerY, 2)
      )
      return distance <= radius
    } else if (shape.type === 'triangle') {
      // Vérifier si le point est dans le triangle
      const x1 = shape.x + shape.width / 2
      const y1 = shape.y
      const x2 = shape.x
      const y2 = shape.y + shape.height
      const x3 = shape.x + shape.width
      const y3 = shape.y + shape.height

      // Utiliser la méthode des coordonnées barycentriques
      const v0x = x3 - x1
      const v0y = y3 - y1
      const v1x = x2 - x1
      const v1y = y2 - y1
      const v2x = worldX - x1
      const v2y = worldY - y1

      const dot00 = v0x * v0x + v0y * v0y
      const dot01 = v0x * v1x + v0y * v1y
      const dot02 = v0x * v2x + v0y * v2y
      const dot11 = v1x * v1x + v1y * v1y
      const dot12 = v1x * v2x + v1y * v2y

      const invDenom = 1 / (dot00 * dot11 - dot01 * dot01)
      const u = (dot11 * dot02 - dot01 * dot12) * invDenom
      const v = (dot00 * dot12 - dot01 * dot02) * invDenom

      return u >= 0 && v >= 0 && u + v <= 1
    }
    return false
  }

  // Fonction pour détecter si une forme intersecte avec un rectangle de sélection
  const isShapeIntersectingRect = (shape: Shape, rect: { startX: number; startY: number; endX: number; endY: number }): boolean => {
    const rectLeft = Math.min(rect.startX, rect.endX)
    const rectRight = Math.max(rect.startX, rect.endX)
    const rectTop = Math.min(rect.startY, rect.endY)
    const rectBottom = Math.max(rect.startY, rect.endY)

    if (shape.type === 'square') {
      // Vérifier l'intersection rectangle-rectangle
      return !(
        shape.x + shape.width < rectLeft ||
        shape.x > rectRight ||
        shape.y + shape.height < rectTop ||
        shape.y > rectBottom
      )
    } else if (shape.type === 'circle') {
      // Vérifier l'intersection cercle-rectangle
      const centerX = shape.x + shape.width / 2
      const centerY = shape.y + shape.height / 2
      const radius = Math.min(shape.width, shape.height) / 2

      // Trouver le point du rectangle le plus proche du centre du cercle
      const closestX = Math.max(rectLeft, Math.min(centerX, rectRight))
      const closestY = Math.max(rectTop, Math.min(centerY, rectBottom))

      // Calculer la distance entre le centre et ce point
      const distanceX = centerX - closestX
      const distanceY = centerY - closestY
      const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY)

      // Vérifier si le cercle intersecte le rectangle
      return distance <= radius
    } else if (shape.type === 'triangle') {
      // Pour le triangle, vérifier si au moins un sommet est dans le rectangle
      // ou si le rectangle intersecte avec les bords du triangle
      const x1 = shape.x + shape.width / 2
      const y1 = shape.y
      const x2 = shape.x
      const y2 = shape.y + shape.height
      const x3 = shape.x + shape.width
      const y3 = shape.y + shape.height

      // Vérifier si un sommet est dans le rectangle
      const pointInRect = (px: number, py: number) => 
        px >= rectLeft && px <= rectRight && py >= rectTop && py <= rectBottom

      if (pointInRect(x1, y1) || pointInRect(x2, y2) || pointInRect(x3, y3)) {
        return true
      }

      // Vérifier si le centre du rectangle est dans le triangle
      const rectCenterX = (rectLeft + rectRight) / 2
      const rectCenterY = (rectTop + rectBottom) / 2
      if (isPointInShape(rectCenterX, rectCenterY, shape)) {
        return true
      }

      // Vérifier l'intersection avec les bords (approximation simple)
      const shapeLeft = Math.min(x1, x2, x3)
      const shapeRight = Math.max(x1, x2, x3)
      const shapeTop = Math.min(y1, y2, y3)
      const shapeBottom = Math.max(y1, y2, y3)

      return !(
        shapeRight < rectLeft ||
        shapeLeft > rectRight ||
        shapeBottom < rectTop ||
        shapeTop > rectBottom
      )
    }
    return false
  }

  // Fonction pour centrer la vue sur l'origine (0,0)
  const centerAtOrigin = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const rect = canvas.getBoundingClientRect()
    const canvasWidth = rect.width
    const canvasHeight = rect.height
    
    // Centrer le point (0,0) au centre du canvas
    setViewState({
      x: canvasWidth / 2,
      y: canvasHeight / 2,
      zoom: 1
    })
  }

  // Fonction pour obtenir les coordonnées monde du centre visible
  const getCenterWorldCoords = (): { x: number; y: number } | null => {
    const canvas = canvasRef.current
    if (!canvas) return null
    
    const rect = canvas.getBoundingClientRect()
    const canvasWidth = rect.width
    const canvasHeight = rect.height
    
    // Le centre du canvas en coordonnées écran
    const centerScreenX = canvasWidth / 2
    const centerScreenY = canvasHeight / 2
    
    // Convertir en coordonnées monde
    const worldX = (centerScreenX - viewState.x) / viewState.zoom
    const worldY = (centerScreenY - viewState.y) / viewState.zoom
    
    return { x: worldX, y: worldY }
  }

  // Fonction pour recentrer la vue sur toutes les formes
  const fitToView = () => {
    if (shapes.length === 0) {
      // Si aucune forme, recentrer à l'origine (0,0) au centre
      centerAtOrigin()
      return
    }

    // Calculer la bounding box de toutes les formes
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    shapes.forEach((shape) => {
      if (shape.type === 'square' || shape.type === 'triangle') {
        minX = Math.min(minX, shape.x)
        minY = Math.min(minY, shape.y)
        maxX = Math.max(maxX, shape.x + shape.width)
        maxY = Math.max(maxY, shape.y + shape.height)
      } else if (shape.type === 'circle') {
        const radius = Math.min(shape.width, shape.height) / 2
        minX = Math.min(minX, shape.x + shape.width / 2 - radius)
        minY = Math.min(minY, shape.y + shape.height / 2 - radius)
        maxX = Math.max(maxX, shape.x + shape.width / 2 + radius)
        maxY = Math.max(maxY, shape.y + shape.height / 2 + radius)
      }
    })

    // Ajouter un padding autour des formes
    const padding = 50
    minX -= padding
    minY -= padding
    maxX += padding
    maxY += padding

    const boundsWidth = maxX - minX
    const boundsHeight = maxY - minY
    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2

    const canvas = canvasRef.current
    if (!canvas) return

    // Utiliser les dimensions réelles du canvas plutôt que window.innerWidth
    const rect = canvas.getBoundingClientRect()
    const canvasWidth = rect.width
    const canvasHeight = rect.height

    // Calculer le zoom pour que toutes les formes soient visibles
    const scaleX = canvasWidth / boundsWidth
    const scaleY = canvasHeight / boundsHeight
    const newZoom = Math.min(scaleX, scaleY, 2) // Limiter le zoom max à 2x

    // Centrer la vue sur les formes
    const newX = canvasWidth / 2 - centerX * newZoom
    const newY = canvasHeight / 2 - centerY * newZoom

    setViewState({
      x: newX,
      y: newY,
      zoom: newZoom,
    })
  }

  // Exposer les fonctions via ref
  useImperativeHandle(ref, () => ({
    fitToView,
    setViewState: (newViewState: { x: number; y: number; zoom: number }) => {
      setViewState(newViewState)
    },
    getViewState: () => viewState,
    getCenterWorldCoords,
    centerAtOrigin,
  }))

  // Notifier les changements de vue avec debounce
  useEffect(() => {
    if (!onViewStateChange) return

    const timeoutId = setTimeout(() => {
      onViewStateChange(viewState)
    }, 300) // Debounce de 300ms pour éviter trop de notifications

    return () => clearTimeout(timeoutId)
  }, [viewState, onViewStateChange])

  // Gestion de la touche Espace
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault()
        setIsSpacePressed(true)
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault()
        setIsSpacePressed(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  // Gestion du pan (déplacement) et zoom
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()

      const rect = canvas.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top

      // Détection du zoom (Ctrl/Cmd + wheel ou pincement trackpad)
      // Sur macOS, les événements wheel avec ctrlKey indiquent un pincement
      if (e.ctrlKey || e.metaKey) {
        // Zoom - utiliser prev pour avoir les valeurs les plus récentes après un pan
        setViewState((prev: ViewState) => {
          const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1
          const newZoom = Math.max(0.1, Math.min(5, prev.zoom * zoomFactor))

          // Zoom vers le point de la souris avec les valeurs à jour
          const worldX = (mouseX - prev.x) / prev.zoom
          const worldY = (mouseY - prev.y) / prev.zoom

          return {
            x: mouseX - worldX * newZoom,
            y: mouseY - worldY * newZoom,
            zoom: newZoom,
          }
        })
      } else {
        // Pan (déplacement) - comme n8n avec deux doigts sur trackpad
        setViewState((prev: ViewState) => ({
          ...prev,
          x: prev.x - e.deltaX,
          y: prev.y - e.deltaY,
        }))
      }
    }

    // Gestion du pan avec la souris (click + drag)
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        // Clic gauche
        e.preventDefault()
        
        const rect = canvas.getBoundingClientRect()
        const mouseX = e.clientX - rect.left
        const mouseY = e.clientY - rect.top

        // Convertir les coordonnées du clic en coordonnées du monde
        const worldX = (mouseX - viewState.x) / viewState.zoom
        const worldY = (mouseY - viewState.y) / viewState.zoom

        // Vérifier si on clique sur une forme (en ordre inverse pour prendre la forme au-dessus)
        let clickedShape: Shape | null = null
        for (let i = shapes.length - 1; i >= 0; i--) {
          if (isPointInShape(worldX, worldY, shapes[i])) {
            clickedShape = shapes[i]
            break
          }
        }

        // Déterminer si on est en mode sélection (bouton ou Espace)
        const isSelectionMode = canvasMode === 'select' || isSpacePressed

        // Vérifier si une forme sélectionnée est cliquée
        const clickedSelectedShape = clickedShape && selectedShapeIds.has(clickedShape.id) ? clickedShape : null

        if (clickedSelectedShape && onShapesMove && selectedShapeIds.size > 1 && !isSelectionMode) {
          // Commencer le déplacement de plusieurs formes (seulement si pas en mode sélection)
          setIsDraggingMultipleShapes(true)
          setDragOffset({
            x: worldX - clickedSelectedShape.x,
            y: worldY - clickedSelectedShape.y,
          })
          // Stocker les positions initiales de toutes les formes sélectionnées
          const initialPositions = new Map<string, { x: number; y: number }>()
          shapes.forEach(shape => {
            if (selectedShapeIds.has(shape.id)) {
              initialPositions.set(shape.id, { x: shape.x, y: shape.y })
            }
          })
          setInitialShapesPositions(initialPositions)
          setLastPanPoint({ x: e.clientX, y: e.clientY })
          hasMovedRef.current = false
        } else if (clickedShape && onShapeMove && !isSelectionMode) {
          // Commencer le déplacement d'une seule forme (si pas en mode sélection)
          setSelectedShapeId(clickedShape.id)
          setSelectedShapeIds(new Set([clickedShape.id]))
          setIsDraggingShape(true)
          // Calculer l'offset entre le point de clic et la position de la forme
          setDragOffset({
            x: worldX - clickedShape.x,
            y: worldY - clickedShape.y,
          })
          setLastPanPoint({ x: e.clientX, y: e.clientY })
          hasMovedRef.current = false
        } else {
          // Désélectionner si on clique en dehors (sauf si en mode sélection)
          if (!isSelectionMode) {
            setSelectedShapeId(null)
            setSelectedShapeIds(new Set())
          }
          
          // Initialiser pour pan ou sélection
          setLastPanPoint({ x: e.clientX, y: e.clientY })
          panStartRef.current = { x: e.clientX, y: e.clientY }
          hasMovedRef.current = false
          
          // Si en mode sélection (bouton ou Espace), commencer la sélection immédiatement
          if (isSelectionMode) {
            setIsSelecting(true)
            const worldStartX = (mouseX - viewState.x) / viewState.zoom
            const worldStartY = (mouseY - viewState.y) / viewState.zoom
            setSelectionStartPoint({ x: worldStartX, y: worldStartY })
            setSelectionRect({
              startX: worldStartX,
              startY: worldStartY,
              endX: worldStartX,
              endY: worldStartY,
            })
          } else {
            // Sinon, préparer le pan
            setIsPanning(true)
          }
        }
      } else if (e.button === 1) {
        // Clic milieu - Pan
        e.preventDefault()
        setIsPanning(true)
        setLastPanPoint({ x: e.clientX, y: e.clientY })
      }
    }

    const handleMouseMove = (e: MouseEvent) => {
      const canvasRect = canvas.getBoundingClientRect()
      const mouseX = e.clientX - canvasRect.left
      const mouseY = e.clientY - canvasRect.top

      if (isDraggingMultipleShapes && onShapesMove && selectedShapeIds.size > 0 && initialShapesPositions.size > 0) {
        // Déplacer plusieurs formes
        const worldX = (mouseX - viewState.x) / viewState.zoom
        const worldY = (mouseY - viewState.y) / viewState.zoom

        const selectedShape = shapes.find(s => s.id === Array.from(selectedShapeIds)[0])
        const initialPos = initialShapesPositions.get(Array.from(selectedShapeIds)[0])
        if (selectedShape && initialPos) {
          // Calculer le décalage depuis la position initiale
          const newShapeX = worldX - dragOffset.x
          const newShapeY = worldY - dragOffset.y
          const deltaX = newShapeX - initialPos.x
          const deltaY = newShapeY - initialPos.y
          onShapesMove(Array.from(selectedShapeIds), deltaX, deltaY)
        }
      } else if (isDraggingShape && selectedShapeId && onShapeMove) {
        // Déplacer une seule forme
        const worldX = (mouseX - viewState.x) / viewState.zoom
        const worldY = (mouseY - viewState.y) / viewState.zoom

        // Mettre à jour la position de la forme en soustrayant l'offset
        const newX = worldX - dragOffset.x
        const newY = worldY - dragOffset.y

        onShapeMove(selectedShapeId, newX, newY)
      } else if (isSelecting) {
        // Mettre à jour le rectangle de sélection
        const worldX = (mouseX - viewState.x) / viewState.zoom
        const worldY = (mouseY - viewState.y) / viewState.zoom

        const newRect = {
          startX: selectionStartPoint.x,
          startY: selectionStartPoint.y,
          endX: worldX,
          endY: worldY,
        }

        setSelectionRect(newRect)

        // Détecter les formes intersectées
        const intersectingShapes = shapes.filter(shape => isShapeIntersectingRect(shape, newRect))
        setSelectedShapeIds(new Set(intersectingShapes.map(s => s.id)))
      } else if (isPanning) {
        // Pan normal
        const panDx = e.clientX - lastPanPoint.x
        const panDy = e.clientY - lastPanPoint.y
        setViewState((prev: ViewState) => ({
          ...prev,
          x: prev.x + panDx,
          y: prev.y + panDy,
        }))
        setLastPanPoint({ x: e.clientX, y: e.clientY })
        hasMovedRef.current = true
      }
    }

    const handleMouseUp = () => {
      if (isSelecting && selectionRect) {
        // Finaliser la sélection
        setIsSelecting(false)
        const finalRect = {
          startX: selectionStartPoint.x,
          startY: selectionStartPoint.y,
          endX: selectionRect.endX,
          endY: selectionRect.endY,
        }
        
        // Détecter les formes finales intersectées
        const intersectingShapes = shapes.filter(shape => isShapeIntersectingRect(shape, finalRect))
        const selectedIds = new Set(intersectingShapes.map(s => s.id))
        setSelectedShapeIds(selectedIds)
        
        if (selectedIds.size === 1) {
          setSelectedShapeId(Array.from(selectedIds)[0])
        } else {
          setSelectedShapeId(null)
        }
        
        setSelectionRect(null)
      }
      
      setIsPanning(false)
      setIsDraggingShape(false)
      setIsDraggingMultipleShapes(false)
      setDragOffset({ x: 0, y: 0 })
      setInitialShapesPositions(new Map())
      hasMovedRef.current = false
    }

    // Gestion du trackpad (gesture events)
    const handleGestureStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        setIsPanning(true)
        const touch1 = e.touches[0]
        const touch2 = e.touches[1]
        const centerX = (touch1.clientX + touch2.clientX) / 2
        const centerY = (touch1.clientY + touch2.clientY) / 2
        setLastPanPoint({ x: centerX, y: centerY })
        // Stocker la distance initiale
        lastTouchDistanceRef.current = Math.hypot(
          touch2.clientX - touch1.clientX,
          touch2.clientY - touch1.clientY
        )
      }
    }

    const handleGestureMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && isPanning) {
        const touch1 = e.touches[0]
        const touch2 = e.touches[1]
        const centerX = (touch1.clientX + touch2.clientX) / 2
        const centerY = (touch1.clientY + touch2.clientY) / 2

        const dx = centerX - lastPanPoint.x
        const dy = centerY - lastPanPoint.y

        // Distance entre les deux doigts pour le zoom
        const distance = Math.hypot(
          touch2.clientX - touch1.clientX,
          touch2.clientY - touch1.clientY
        )

        if (lastTouchDistanceRef.current !== null && Math.abs(distance - lastTouchDistanceRef.current) > 5) {
          // Zoom par pincement
          const rect = canvas.getBoundingClientRect()
          const mouseX = centerX - rect.left
          const mouseY = centerY - rect.top

          const zoomFactor = distance / lastTouchDistanceRef.current
          
          setViewState((prev: ViewState) => {
            const newZoom = Math.max(0.1, Math.min(5, prev.zoom * zoomFactor))
            const worldX = (mouseX - prev.x) / prev.zoom
            const worldY = (mouseY - prev.y) / prev.zoom

            return {
              x: mouseX - worldX * newZoom,
              y: mouseY - worldY * newZoom,
              zoom: newZoom,
            }
          })
          
          lastTouchDistanceRef.current = distance
        } else {
          // Pan
          setViewState((prev: ViewState) => ({
            ...prev,
            x: prev.x + dx,
            y: prev.y + dy,
          }))
          
          lastTouchDistanceRef.current = distance
        }

        setLastPanPoint({ x: centerX, y: centerY })
      }
    }

    const handleGestureEnd = () => {
      setIsPanning(false)
      lastTouchDistanceRef.current = null
    }

    // Gestion du clic droit (menu contextuel)
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault()
      if (!onContextMenu) return

      const rect = canvas.getBoundingClientRect()
      const clientX = e.clientX
      const clientY = e.clientY
      const mouseX = clientX - rect.left
      const mouseY = clientY - rect.top

      // Convertir les coordonnées du clic en coordonnées du monde
      const worldX = (mouseX - viewState.x) / viewState.zoom
      const worldY = (mouseY - viewState.y) / viewState.zoom

      onContextMenu(worldX, worldY, clientX, clientY)
    }

    canvas.addEventListener('wheel', handleWheel, { passive: false })
    canvas.addEventListener('mousedown', handleMouseDown)
    canvas.addEventListener('contextmenu', handleContextMenu)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    canvas.addEventListener('touchstart', handleGestureStart, { passive: false })
    canvas.addEventListener('touchmove', handleGestureMove, { passive: false })
    canvas.addEventListener('touchend', handleGestureEnd)

    return () => {
      canvas.removeEventListener('wheel', handleWheel)
      canvas.removeEventListener('mousedown', handleMouseDown)
      canvas.removeEventListener('contextmenu', handleContextMenu)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      canvas.removeEventListener('touchstart', handleGestureStart)
      canvas.removeEventListener('touchmove', handleGestureMove)
      canvas.removeEventListener('touchend', handleGestureEnd)
    }
  }, [viewState, isPanning, isDraggingShape, isDraggingMultipleShapes, isSelecting, selectedShapeId, selectedShapeIds, selectionRect, selectionStartPoint, isSpacePressed, canvasMode, dragOffset, initialShapesPositions, shapes, onContextMenu, onShapeMove, onShapesMove])


  // Rendu du canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Ajuster la taille du canvas à son conteneur (en tenant compte de la sidebar)
    const resizeCanvas = () => {
      // Utiliser les dimensions réelles du canvas plutôt que window.innerWidth
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width
      canvas.height = rect.height
    }

    // Fonctions de rendu pour chaque type de fond
    const drawBackground = (ctx: CanvasRenderingContext2D, type: BackgroundType, zoom: number) => {
      // Fond blanc de base
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(-10000, -10000, 20000, 20000)

      const gridSize = 50
      const lineWidth = 1 / zoom

      switch (type) {
        case 'grid':
          // Grille normale (défaut)
          ctx.strokeStyle = '#f0f0f0'
          ctx.lineWidth = lineWidth
          for (let x = -10000; x < 10000; x += gridSize) {
            ctx.beginPath()
            ctx.moveTo(x, -10000)
            ctx.lineTo(x, 10000)
            ctx.stroke()
          }
          for (let y = -10000; y < 10000; y += gridSize) {
            ctx.beginPath()
            ctx.moveTo(-10000, y)
            ctx.lineTo(10000, y)
            ctx.stroke()
          }
          break

        case 'radar':
          // Grille radar avec centre marqué
          ctx.strokeStyle = '#f0f0f0'
          ctx.lineWidth = lineWidth
          
          // Grille normale
          for (let x = -10000; x < 10000; x += gridSize) {
            ctx.beginPath()
            ctx.moveTo(x, -10000)
            ctx.lineTo(x, 10000)
            ctx.stroke()
          }
          for (let y = -10000; y < 10000; y += gridSize) {
            ctx.beginPath()
            ctx.moveTo(-10000, y)
            ctx.lineTo(10000, y)
            ctx.stroke()
          }
          
          // Ligne verticale centrale (plus épaisse)
          ctx.strokeStyle = '#d0d0d0'
          ctx.lineWidth = 2 / zoom
          ctx.beginPath()
          ctx.moveTo(0, -10000)
          ctx.lineTo(0, 10000)
          ctx.stroke()
          
          // Ligne horizontale centrale (plus épaisse)
          ctx.beginPath()
          ctx.moveTo(-10000, 0)
          ctx.lineTo(10000, 0)
          ctx.stroke()
          
          // Petits traits plus épais sur les axes principaux (tous les 100px)
          ctx.strokeStyle = '#c0c0c0'
          ctx.lineWidth = 1.5 / zoom
          for (let x = -10000; x < 10000; x += 100) {
            if (x !== 0 && x % 100 === 0) {
              ctx.beginPath()
              ctx.moveTo(x, -5)
              ctx.lineTo(x, 5)
              ctx.stroke()
            }
          }
          for (let y = -10000; y < 10000; y += 100) {
            if (y !== 0 && y % 100 === 0) {
              ctx.beginPath()
              ctx.moveTo(-5, y)
              ctx.lineTo(5, y)
              ctx.stroke()
            }
          }
          break

        case 'dots':
          // Fond avec points
          ctx.fillStyle = '#e0e0e0'
          const dotSize = 2 / zoom
          const dotSpacing = gridSize
          for (let x = -10000; x < 10000; x += dotSpacing) {
            for (let y = -10000; y < 10000; y += dotSpacing) {
              ctx.beginPath()
              ctx.arc(x, y, dotSize, 0, Math.PI * 2)
              ctx.fill()
            }
          }
          break

        case 'diagonal':
          // Lignes diagonales
          ctx.strokeStyle = '#f0f0f0'
          ctx.lineWidth = lineWidth
          const diagonalSpacing = gridSize * 2
          // Lignes diagonales montantes
          for (let offset = -20000; offset < 20000; offset += diagonalSpacing) {
            ctx.beginPath()
            ctx.moveTo(-10000 + offset, -10000)
            ctx.lineTo(10000, -10000 + offset + 20000)
            ctx.stroke()
          }
          // Lignes diagonales descendantes
          for (let offset = -20000; offset < 20000; offset += diagonalSpacing) {
            ctx.beginPath()
            ctx.moveTo(-10000, -10000 + offset)
            ctx.lineTo(10000, 10000 + offset)
            ctx.stroke()
          }
          break

        case 'graph':
          // Papier quadrillé (style graphique)
          ctx.strokeStyle = '#e8e8e8'
          ctx.lineWidth = lineWidth
          // Lignes verticales fines
          for (let x = -10000; x < 10000; x += gridSize) {
            ctx.beginPath()
            ctx.moveTo(x, -10000)
            ctx.lineTo(x, 10000)
            ctx.stroke()
          }
          // Lignes horizontales fines
          for (let y = -10000; y < 10000; y += gridSize) {
            ctx.beginPath()
            ctx.moveTo(-10000, y)
            ctx.lineTo(10000, y)
            ctx.stroke()
          }
          // Lignes principales tous les 5 carreaux
          ctx.strokeStyle = '#d0d0d0'
          ctx.lineWidth = 1.5 / zoom
          for (let x = -10000; x < 10000; x += gridSize * 5) {
            ctx.beginPath()
            ctx.moveTo(x, -10000)
            ctx.lineTo(x, 10000)
            ctx.stroke()
          }
          for (let y = -10000; y < 10000; y += gridSize * 5) {
            ctx.beginPath()
            ctx.moveTo(-10000, y)
            ctx.lineTo(10000, y)
            ctx.stroke()
          }
          break

        case 'isometric':
          // Grille isométrique
          ctx.strokeStyle = '#e8e8e8'
          ctx.lineWidth = lineWidth
          const isoSize = gridSize * 2
          // Lignes diagonales vers la droite
          for (let i = -200; i < 200; i++) {
            const startX = i * isoSize
            const startY = -10000
            ctx.beginPath()
            ctx.moveTo(startX, startY)
            ctx.lineTo(startX + 20000, startY + 20000)
            ctx.stroke()
          }
          // Lignes diagonales vers la gauche
          for (let i = -200; i < 200; i++) {
            const startX = i * isoSize
            const startY = -10000
            ctx.beginPath()
            ctx.moveTo(startX, startY)
            ctx.lineTo(startX - 20000, startY + 20000)
            ctx.stroke()
          }
          // Lignes horizontales
          for (let y = -10000; y < 10000; y += isoSize / 2) {
            ctx.beginPath()
            ctx.moveTo(-10000, y)
            ctx.lineTo(10000, y)
            ctx.stroke()
          }
          break
      }
    }

    // Fonction de rendu
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Transformer le contexte selon la vue
      ctx.save()
      ctx.translate(viewState.x, viewState.y)
      ctx.scale(viewState.zoom, viewState.zoom)

      // Dessiner le fond selon le type sélectionné
      drawBackground(ctx, backgroundType, viewState.zoom)

      // Dessiner les formes
      shapes.forEach((shape) => {
        const isSelected = selectedShapeIds.has(shape.id)
        
        ctx.fillStyle = shape.color
        
        if (shape.type === 'square') {
          ctx.fillRect(shape.x, shape.y, shape.width, shape.height)
          if (isSelected) {
            // Dessiner un contour pour la forme sélectionnée
            ctx.strokeStyle = '#0066ff'
            ctx.lineWidth = 2 / viewState.zoom
            ctx.strokeRect(shape.x, shape.y, shape.width, shape.height)
          }
        } else if (shape.type === 'circle') {
          const centerX = shape.x + shape.width / 2
          const centerY = shape.y + shape.height / 2
          const radius = Math.min(shape.width, shape.height) / 2
          ctx.beginPath()
          ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
          ctx.fill()
          if (isSelected) {
            ctx.strokeStyle = '#0066ff'
            ctx.lineWidth = 2 / viewState.zoom
            ctx.stroke()
          }
        } else if (shape.type === 'triangle') {
          ctx.beginPath()
          ctx.moveTo(shape.x + shape.width / 2, shape.y)
          ctx.lineTo(shape.x, shape.y + shape.height)
          ctx.lineTo(shape.x + shape.width, shape.y + shape.height)
          ctx.closePath()
          ctx.fill()
          if (isSelected) {
            ctx.strokeStyle = '#0066ff'
            ctx.lineWidth = 2 / viewState.zoom
            ctx.stroke()
          }
        }
      })

      // Dessiner le rectangle de sélection
      if (selectionRect) {
        const rectLeft = Math.min(selectionRect.startX, selectionRect.endX)
        const rectRight = Math.max(selectionRect.startX, selectionRect.endX)
        const rectTop = Math.min(selectionRect.startY, selectionRect.endY)
        const rectBottom = Math.max(selectionRect.startY, selectionRect.endY)
        
        ctx.strokeStyle = '#0066ff'
        ctx.lineWidth = 1 / viewState.zoom
        ctx.setLineDash([5 / viewState.zoom, 5 / viewState.zoom])
        ctx.strokeRect(rectLeft, rectTop, rectRight - rectLeft, rectBottom - rectTop)
        
        ctx.fillStyle = 'rgba(0, 102, 255, 0.1)'
        ctx.fillRect(rectLeft, rectTop, rectRight - rectLeft, rectBottom - rectTop)
        
        ctx.setLineDash([])
      }

      ctx.restore()
    }

    resizeCanvas()
    
    const resizeObserver = new ResizeObserver(() => {
      resizeCanvas()
      render()
    })
    
    resizeObserver.observe(canvas)
    
    window.addEventListener('resize', () => {
      resizeCanvas()
      render()
    })

    render()

    return () => {
      window.removeEventListener('resize', resizeCanvas)
      resizeObserver.disconnect()
    }
  }, [viewState, shapes, selectedShapeId, selectedShapeIds, selectionRect, backgroundType])

  return (
    <div className="canvas-container">
      <div className="canvas-mode-controls">
        <button
          className={`mode-button ${canvasMode === 'pan' ? 'active' : ''}`}
          onClick={() => setCanvasMode('pan')}
          title="Mode pan (maintenir Espace pour sélectionner)"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 11v-1a2 2 0 0 0-2-2h-1"/>
            <path d="M9 10H2m16 4h-1a2 2 0 0 1-2 2v-1"/>
            <path d="M9 14H2"/>
            <path d="M10 10.5V6a2 2 0 0 1 2-2v0a2 2 0 0 1 2 2v4.5"/>
            <path d="M14 9.5V8a2 2 0 0 1 2-2v0a2 2 0 0 1 2 2v1.5"/>
            <path d="M18 11V9a2 2 0 0 1 4 0v2"/>
          </svg>
          <span>Pan</span>
        </button>
        <button
          className={`mode-button ${canvasMode === 'select' ? 'active' : ''}`}
          onClick={() => setCanvasMode('select')}
          title="Mode sélection"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          </svg>
          <span>Sélection</span>
        </button>
      </div>
      <canvas
        ref={canvasRef}
        className="canvas"
        style={{ cursor: isDraggingShape || isDraggingMultipleShapes ? 'grabbing' : isPanning ? 'grabbing' : isSelecting ? 'crosshair' : canvasMode === 'select' ? 'crosshair' : 'grab' }}
      />
    </div>
  )
})

Canvas.displayName = 'Canvas'

export default Canvas

