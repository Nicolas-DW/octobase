import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react'
import type { Shape } from '../App'
import TextBlock from './TextBlock'
import ShapeBlock from './ShapeBlock'
import { screenToWorld, clientToWorld, worldToScreen, type ViewState as CoordinateViewState } from '../utils/coordinateUtils'
import './Canvas.css'

export type BackgroundType = 'grid' | 'radar' | 'dots' | 'diagonal' | 'graph' | 'isometric'
export type CanvasMode = 'pan' | 'select'

interface CanvasProps {
  shapes: Shape[]
  onContextMenu?: (worldX: number, worldY: number, clientX: number, clientY: number) => void
  onShapeMove?: (shapeId: string, newX: number, newY: number) => void
  onShapesMove?: (shapeIds: string[], deltaX: number, deltaY: number) => void
  onViewStateChange?: (viewState: ViewState) => void
  onTextContentChange?: (shapeId: string, content: string) => void
  backgroundType?: BackgroundType
}

interface ViewState {
  x: number
  y: number
  zoom: number
}

// Convertir ViewState en CoordinateViewState pour les fonctions utilitaires
const toCoordinateViewState = (vs: ViewState): CoordinateViewState => vs

export interface CanvasHandle {
  fitToView: () => void
  setViewState: (viewState: { x: number; y: number; zoom: number }) => void
  getViewState: () => { x: number; y: number; zoom: number }
  getCenterWorldCoords: () => { x: number; y: number } | null
  centerAtOrigin: () => void
}

const Canvas = forwardRef<CanvasHandle, CanvasProps>(({ shapes, onContextMenu, onShapeMove, onShapesMove, onViewStateChange, onTextContentChange, backgroundType = 'grid' }, ref) => {
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
  const [isHoveringShape, setIsHoveringShape] = useState(false)
  const [hoveredShapeId, setHoveredShapeId] = useState<string | null>(null)
  const [editingTextId, setEditingTextId] = useState<string | null>(null)
  const lastTouchDistanceRef = useRef<number | null>(null)
  const panStartRef = useRef({ x: 0, y: 0 })
  const hasMovedRef = useRef(false)

  // Fonction pour détecter si un point est dans une forme
  const isPointInShape = (worldX: number, worldY: number, shape: Shape): boolean => {
    if (shape.type === 'text') {
      return (
        worldX >= shape.x &&
        worldX <= shape.x + shape.width &&
        worldY >= shape.y &&
        worldY <= shape.y + shape.height
      )
    } else if (shape.type === 'square') {
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

    if (shape.type === 'text' || shape.type === 'square') {
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
    
    // Convertir en coordonnées monde en utilisant la fonction utilitaire
    return screenToWorld(centerScreenX, centerScreenY, toCoordinateViewState(viewState))
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
      if (shape.type === 'square' || shape.type === 'triangle' || shape.type === 'text') {
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

      // IMPORTANT: getBoundingClientRect() donne la position réelle du canvas dans la fenêtre
      // Cela fonctionne automatiquement avec la sidebar ouverte ou fermée, et avec n'importe quelle taille
      // car il retourne toujours la position actuelle du canvas par rapport à la fenêtre
      const rect = canvas.getBoundingClientRect()

      // Détection du zoom (Ctrl/Cmd + wheel ou pincement trackpad)
      // Sur macOS, les événements wheel avec ctrlKey indiquent un pincement
      if (e.ctrlKey || e.metaKey) {
        // Zoom - zoomer vers le point de la souris (plus intuitif)
        // Les coordonnées client sont relatives à la fenêtre, on doit les convertir en coordonnées canvas
        // Cette conversion tient automatiquement compte de la position du canvas (sidebar ouverte/fermée)
        const mouseX = e.clientX - rect.left  // Coordonnée X relative au canvas
        const mouseY = e.clientY - rect.top   // Coordonnée Y relative au canvas
        
        setViewState((prev: ViewState) => {
          const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1
          const newZoom = Math.max(0.1, Math.min(5, prev.zoom * zoomFactor))

          // Calculer où se trouve le point de la souris en coordonnées monde AVANT le zoom
          const worldX = (mouseX - prev.x) / prev.zoom
          const worldY = (mouseY - prev.y) / prev.zoom
          
          // Ajuster x et y pour que le point de la souris reste à la même position monde après le zoom
          // Cela garantit que le zoom se fait vers le point de la souris, pas vers le centre
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
        
        // Convertir les coordonnées du clic en coordonnées du monde en utilisant la fonction utilitaire
        const { x: worldX, y: worldY } = clientToWorld(e.clientX, e.clientY, rect, toCoordinateViewState(viewState))

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

        // Si on clique sur une forme sélectionnée, permettre de la déplacer (même en mode sélection)
        if (clickedSelectedShape && onShapesMove && selectedShapeIds.size > 1) {
          // Commencer le déplacement de plusieurs formes
          setIsDraggingMultipleShapes(true)
          // Stocker la position de la souris en coordonnées monde au moment du clic
          setDragStartMousePos({ worldX, worldY })
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
        } else if (clickedSelectedShape && onShapeMove && selectedShapeIds.size === 1) {
          // Commencer le déplacement d'une seule forme sélectionnée
          setIsDraggingShape(true)
          // Calculer l'offset entre le point de clic et la position de la forme
          setDragOffset({
            x: worldX - clickedSelectedShape.x,
            y: worldY - clickedSelectedShape.y,
          })
          setLastPanPoint({ x: e.clientX, y: e.clientY })
          hasMovedRef.current = false
        } else if (clickedShape && onShapeMove && !isSelectionMode) {
          // Commencer le déplacement d'une seule forme non sélectionnée (seulement si pas en mode sélection)
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
            const { x: worldStartX, y: worldStartY } = clientToWorld(e.clientX, e.clientY, rect, toCoordinateViewState(viewState))
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

      // Détecter si la souris survole une forme (seulement si pas en train de drag/pan/select)
      if (!isDraggingShape && !isDraggingMultipleShapes && !isPanning && !isSelecting) {
        // Convertir en coordonnées monde en utilisant la fonction utilitaire
        const { x: worldX, y: worldY } = clientToWorld(e.clientX, e.clientY, canvasRect, toCoordinateViewState(viewState))
        
        // Vérifier si on survole une forme (en ordre inverse pour prendre la forme au-dessus)
        let hoveredShape: Shape | null = null
        for (let i = shapes.length - 1; i >= 0; i--) {
          if (isPointInShape(worldX, worldY, shapes[i])) {
            hoveredShape = shapes[i]
            break
          }
        }
        
        // Mettre à jour le survol - on est sur une forme si on survole n'importe quelle forme
        setIsHoveringShape(hoveredShape !== null)
        setHoveredShapeId(hoveredShape ? hoveredShape.id : null)
      }

      if (isDraggingMultipleShapes && onShapesMove && selectedShapeIds.size > 0 && initialShapesPositions.size > 0 && dragStartMousePos) {
        // Déplacer plusieurs formes
        const canvasRect = canvas.getBoundingClientRect()
        const { x: worldX, y: worldY } = clientToWorld(e.clientX, e.clientY, canvasRect, toCoordinateViewState(viewState))

        // Calculer le delta depuis la position de départ de la souris
        const deltaX = worldX - dragStartMousePos.worldX
        const deltaY = worldY - dragStartMousePos.worldY
        
        // Appliquer ce delta à toutes les formes sélectionnées
        onShapesMove(Array.from(selectedShapeIds), deltaX, deltaY)
      } else if (isDraggingShape && selectedShapeId && onShapeMove) {
        // Déplacer une seule forme
        const canvasRect = canvas.getBoundingClientRect()
        const { x: worldX, y: worldY } = clientToWorld(e.clientX, e.clientY, canvasRect, toCoordinateViewState(viewState))

        // Mettre à jour la position de la forme en soustrayant l'offset
        const newX = worldX - dragOffset.x
        const newY = worldY - dragOffset.y

        onShapeMove(selectedShapeId, newX, newY)
      } else if (isSelecting) {
        // Mettre à jour le rectangle de sélection
        const canvasRect = canvas.getBoundingClientRect()
        const { x: worldX, y: worldY } = clientToWorld(e.clientX, e.clientY, canvasRect, toCoordinateViewState(viewState))

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
      setDragStartMousePos(null)
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
          // Zoom par pincement - zoomer vers le centre du pincement (entre les deux doigts)
          const rect = canvas.getBoundingClientRect()
          // Le centre du pincement en coordonnées client (fenêtre)
          const pinchCenterX = centerX - rect.left  // Convertir en coordonnées canvas
          const pinchCenterY = centerY - rect.top   // Convertir en coordonnées canvas

          const zoomFactor = distance / lastTouchDistanceRef.current
          
          setViewState((prev: ViewState) => {
            const newZoom = Math.max(0.1, Math.min(5, prev.zoom * zoomFactor))
            
            // Calculer où se trouve le centre du pincement en coordonnées monde AVANT le zoom
            const worldX = (pinchCenterX - prev.x) / prev.zoom
            const worldY = (pinchCenterY - prev.y) / prev.zoom
            
            // Ajuster x et y pour que le centre du pincement reste à la même position monde après le zoom
            return {
              x: pinchCenterX - worldX * newZoom,
              y: pinchCenterY - worldY * newZoom,
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

    // Gestion du double-clic pour éditer les blocs de texte
    // Cette fonction sera gérée directement par les blocs de texte via leur onDoubleClick
    const handleDoubleClick = () => {
      // Laisser les blocs DOM gérer leur propre double-clic
      // Cette fonction ne fait rien car les blocs sont maintenant en DOM
    }

    // Gestion du clic droit (menu contextuel)
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault()
      if (!onContextMenu) return

      const rect = canvas.getBoundingClientRect()
      const clientX = e.clientX
      const clientY = e.clientY

      // Convertir les coordonnées du clic en coordonnées du monde en utilisant la fonction utilitaire
      const { x: worldX, y: worldY } = clientToWorld(clientX, clientY, rect, toCoordinateViewState(viewState))

      onContextMenu(worldX, worldY, clientX, clientY)
    }

    const handleMouseLeave = () => {
      setIsHoveringShape(false)
      setHoveredShapeId(null)
    }

    canvas.addEventListener('wheel', handleWheel, { passive: false })
    canvas.addEventListener('mousedown', handleMouseDown)
    canvas.addEventListener('dblclick', handleDoubleClick)
    canvas.addEventListener('contextmenu', handleContextMenu)
    canvas.addEventListener('mouseleave', handleMouseLeave)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    canvas.addEventListener('touchstart', handleGestureStart, { passive: false })
    canvas.addEventListener('touchmove', handleGestureMove, { passive: false })
    canvas.addEventListener('touchend', handleGestureEnd)

    return () => {
      canvas.removeEventListener('wheel', handleWheel)
      canvas.removeEventListener('mousedown', handleMouseDown)
      canvas.removeEventListener('dblclick', handleDoubleClick)
      canvas.removeEventListener('contextmenu', handleContextMenu)
      canvas.removeEventListener('mouseleave', handleMouseLeave)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      canvas.removeEventListener('touchstart', handleGestureStart)
      canvas.removeEventListener('touchmove', handleGestureMove)
      canvas.removeEventListener('touchend', handleGestureEnd)
    }
  }, [viewState, isPanning, isDraggingShape, isDraggingMultipleShapes, isSelecting, selectedShapeId, selectedShapeIds, selectionRect, selectionStartPoint, isSpacePressed, canvasMode, dragOffset, dragStartMousePos, initialShapesPositions, shapes, onContextMenu, onShapeMove, onShapesMove, isPointInShape])


  // Rendu du canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Ajuster la taille du canvas à la taille de l'écran seulement (comme Heptabase)
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width
      canvas.height = rect.height
    }

    // Fonctions de rendu pour chaque type de fond
    const drawBackground = (ctx: CanvasRenderingContext2D, type: BackgroundType, zoom: number) => {
      // Constante pour la portée de dessin
      const drawRange = 10000
      
      // Fond blanc de base - couvrir une grande zone
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(-drawRange, -drawRange, drawRange * 2, drawRange * 2)

      const gridSize = 50
      const lineWidth = 1 / zoom

      switch (type) {
        case 'grid':
          // Grille normale (défaut)
          ctx.strokeStyle = '#f0f0f0'
          ctx.lineWidth = lineWidth
          for (let x = -drawRange; x < drawRange; x += gridSize) {
            ctx.beginPath()
            ctx.moveTo(x, -drawRange)
            ctx.lineTo(x, drawRange)
            ctx.stroke()
          }
          for (let y = -drawRange; y < drawRange; y += gridSize) {
            ctx.beginPath()
            ctx.moveTo(-drawRange, y)
            ctx.lineTo(drawRange, y)
            ctx.stroke()
          }
          break

        case 'radar':
          // Grille radar avec centre marqué
          ctx.strokeStyle = '#f0f0f0'
          ctx.lineWidth = lineWidth
          
          // Grille normale
          for (let x = -drawRange; x < drawRange; x += gridSize) {
            ctx.beginPath()
            ctx.moveTo(x, -drawRange)
            ctx.lineTo(x, drawRange)
            ctx.stroke()
          }
          for (let y = -drawRange; y < drawRange; y += gridSize) {
            ctx.beginPath()
            ctx.moveTo(-drawRange, y)
            ctx.lineTo(drawRange, y)
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
          for (let x = -drawRange; x < drawRange; x += 100) {
            if (x !== 0 && x % 100 === 0) {
              ctx.beginPath()
              ctx.moveTo(x, -5)
              ctx.lineTo(x, 5)
              ctx.stroke()
            }
          }
          for (let y = -drawRange; y < drawRange; y += 100) {
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
          for (let x = -drawRange; x < drawRange; x += dotSpacing) {
            for (let y = -drawRange; y < drawRange; y += dotSpacing) {
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
          for (let x = -drawRange; x < drawRange; x += gridSize * 5) {
            ctx.beginPath()
            ctx.moveTo(x, -drawRange)
            ctx.lineTo(x, drawRange)
            ctx.stroke()
          }
          for (let y = -drawRange; y < drawRange; y += gridSize * 5) {
            ctx.beginPath()
            ctx.moveTo(-drawRange, y)
            ctx.lineTo(drawRange, y)
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
            const startY = -drawRange
            ctx.beginPath()
            ctx.moveTo(startX, startY)
            ctx.lineTo(startX + drawRange * 2, startY + drawRange * 2)
            ctx.stroke()
          }
          // Lignes diagonales vers la gauche
          for (let i = -200; i < 200; i++) {
            const startX = i * isoSize
            const startY = -drawRange
            ctx.beginPath()
            ctx.moveTo(startX, startY)
            ctx.lineTo(startX - drawRange * 2, startY + drawRange * 2)
            ctx.stroke()
          }
          // Lignes horizontales
          for (let y = -drawRange; y < drawRange; y += isoSize / 2) {
            ctx.beginPath()
            ctx.moveTo(-drawRange, y)
            ctx.lineTo(drawRange, y)
            ctx.stroke()
          }
          break
      }
    }

    // Fonction de rendu - seulement le background
    // IMPORTANT: Cette transformation doit être EXACTEMENT identique à celle du DOM
    // pour garantir la synchronisation parfaite entre le fond et les éléments.
    // 
    // Le conteneur DOM utilise: transform: translate(x, y) scale(zoom) avec transform-origin: top left
    // La matrice de transformation CSS équivalente est: [zoom 0 x; 0 zoom y; 0 0 1]
    // 
    // Le canvas utilise setTransform avec la même matrice pour garantir la cohérence:
    // setTransform(zoom, 0, 0, zoom, x, y) produit exactement la même matrice
    // 
    // Toutes les conversions de coordonnées utilisent maintenant les fonctions utilitaires
    // de coordinateUtils.ts pour garantir la cohérence partout dans le code.
    const render = () => {
      // S'assurer que le canvas est redimensionné avant de dessiner
      resizeCanvas()
      
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      ctx.save()
      
      // Utiliser setTransform pour appliquer la transformation de manière exacte
      // Cette matrice est identique à celle utilisée par CSS pour le conteneur DOM
      // Cela garantit que les coordonnées du fond correspondent exactement aux éléments
      ctx.setTransform(
        viewState.zoom, 0,           // a, c: scale X et shear X
        0, viewState.zoom,            // b, d: shear Y et scale Y
        viewState.x, viewState.y      // e, f: translate X et Y
      )
      
      // Dessiner le background
      drawBackground(ctx, backgroundType, viewState.zoom)
      
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
      {/* Canvas pour le background - fixe, en dehors du conteneur transformé */}
      <canvas
        ref={canvasRef}
        className="canvas canvas-background"
        style={{ 
          cursor: isDraggingShape || isDraggingMultipleShapes 
            ? 'grabbing' 
            : isPanning 
            ? 'grabbing' 
            : isSelecting 
            ? 'crosshair' 
            : (canvasMode === 'select' && hoveredShapeId && selectedShapeIds.has(hoveredShapeId))
            ? 'move'
            : canvasMode === 'select' 
            ? 'crosshair' 
            : isHoveringShape 
            ? 'move' 
            : 'grab' 
        }}
      />
      {/* Conteneur transformé pour le zoom/pan - comme Heptabase */}
      <div 
        className="canvas-world-container"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          transformOrigin: 'top left',
          transform: `translate(${viewState.x}px, ${viewState.y}px) scale(${viewState.zoom})`,
          pointerEvents: 'none',
        }}
      >
        {/* Rendre toutes les formes géométriques */}
        {shapes
          .filter(shape => shape.type !== 'text')
          .map((shape) => (
            <ShapeBlock
              key={shape.id}
              shape={shape}
              isSelected={selectedShapeIds.has(shape.id)}
              onMouseDown={(e, shapeId) => {
                e.stopPropagation()
                const clickedShape = shapes.find(s => s.id === shapeId)
                if (!clickedShape) return

                const isSelectionMode = canvasMode === 'select' || isSpacePressed
                const isSelected = selectedShapeIds.has(shapeId)

                if (isSelected && onShapesMove && selectedShapeIds.size > 1) {
                  // Déplacer plusieurs formes
                  setIsDraggingMultipleShapes(true)
                  const rect = canvasRef.current?.getBoundingClientRect()
                  if (rect) {
                    const { x: worldX, y: worldY } = clientToWorld(e.clientX, e.clientY, rect, toCoordinateViewState(viewState))
                    setDragStartMousePos({ worldX, worldY })
                    const initialPositions = new Map<string, { x: number; y: number }>()
                    shapes.forEach(s => {
                      if (selectedShapeIds.has(s.id)) {
                        initialPositions.set(s.id, { x: s.x, y: s.y })
                      }
                    })
                    setInitialShapesPositions(initialPositions)
                    setLastPanPoint({ x: e.clientX, y: e.clientY })
                  }
                  hasMovedRef.current = false
                } else if (isSelected && onShapeMove && selectedShapeIds.size === 1) {
                  // Déplacer une seule forme sélectionnée
                  setIsDraggingShape(true)
                  setSelectedShapeId(shapeId)
                  const rect = canvasRef.current?.getBoundingClientRect()
                  if (rect) {
                    const { x: worldX, y: worldY } = clientToWorld(e.clientX, e.clientY, rect, toCoordinateViewState(viewState))
                    setDragOffset({
                      x: worldX - clickedShape.x,
                      y: worldY - clickedShape.y,
                    })
                    setLastPanPoint({ x: e.clientX, y: e.clientY })
                  }
                  hasMovedRef.current = false
                } else if (!isSelectionMode && onShapeMove) {
                  // Commencer le déplacement d'une seule forme non sélectionnée
                  setSelectedShapeId(shapeId)
                  setSelectedShapeIds(new Set([shapeId]))
                  setIsDraggingShape(true)
                  const rect = canvasRef.current?.getBoundingClientRect()
                  if (rect) {
                    const { x: worldX, y: worldY } = clientToWorld(e.clientX, e.clientY, rect, toCoordinateViewState(viewState))
                    setDragOffset({
                      x: worldX - clickedShape.x,
                      y: worldY - clickedShape.y,
                    })
                    setLastPanPoint({ x: e.clientX, y: e.clientY })
                  }
                  hasMovedRef.current = false
                } else if (isSelectionMode) {
                  // Mode sélection - juste sélectionner
                  if (!isSelected) {
                    setSelectedShapeIds(new Set([shapeId]))
                    setSelectedShapeId(shapeId)
                  }
                }
              }}
            />
          ))}
        {/* Rendre tous les blocs de texte */}
        {shapes
          .filter(shape => shape.type === 'text')
          .map((shape) => (
            <TextBlock
              key={shape.id}
              shape={shape}
              isSelected={selectedShapeIds.has(shape.id)}
              isEditing={editingTextId === shape.id}
              onDoubleClick={() => setEditingTextId(shape.id)}
              onContentChange={(content) => {
                if (onTextContentChange) {
                  onTextContentChange(shape.id, content)
                }
              }}
              onBlur={() => setEditingTextId(null)}
              onMouseDown={(e, shapeId) => {
                if (editingTextId === shapeId) return // Ne pas gérer le drag en mode édition
                e.stopPropagation()
                const clickedShape = shapes.find(s => s.id === shapeId)
                if (!clickedShape) return

                const isSelectionMode = canvasMode === 'select' || isSpacePressed
                const isSelected = selectedShapeIds.has(shapeId)

                if (isSelected && onShapesMove && selectedShapeIds.size > 1) {
                  setIsDraggingMultipleShapes(true)
                  const rect = canvasRef.current?.getBoundingClientRect()
                  if (rect) {
                    const { x: worldX, y: worldY } = clientToWorld(e.clientX, e.clientY, rect, toCoordinateViewState(viewState))
                    setDragStartMousePos({ worldX, worldY })
                    const initialPositions = new Map<string, { x: number; y: number }>()
                    shapes.forEach(s => {
                      if (selectedShapeIds.has(s.id)) {
                        initialPositions.set(s.id, { x: s.x, y: s.y })
                      }
                    })
                    setInitialShapesPositions(initialPositions)
                    setLastPanPoint({ x: e.clientX, y: e.clientY })
                  }
                  hasMovedRef.current = false
                } else if (isSelected && onShapeMove && selectedShapeIds.size === 1) {
                  setIsDraggingShape(true)
                  setSelectedShapeId(shapeId)
                  const rect = canvasRef.current?.getBoundingClientRect()
                  if (rect) {
                    const { x: worldX, y: worldY } = clientToWorld(e.clientX, e.clientY, rect, toCoordinateViewState(viewState))
                    setDragOffset({
                      x: worldX - clickedShape.x,
                      y: worldY - clickedShape.y,
                    })
                    setLastPanPoint({ x: e.clientX, y: e.clientY })
                  }
                  hasMovedRef.current = false
                } else if (!isSelectionMode && onShapeMove) {
                  setSelectedShapeId(shapeId)
                  setSelectedShapeIds(new Set([shapeId]))
                  setIsDraggingShape(true)
                  const rect = canvasRef.current?.getBoundingClientRect()
                  if (rect) {
                    const { x: worldX, y: worldY } = clientToWorld(e.clientX, e.clientY, rect, toCoordinateViewState(viewState))
                    setDragOffset({
                      x: worldX - clickedShape.x,
                      y: worldY - clickedShape.y,
                    })
                    setLastPanPoint({ x: e.clientX, y: e.clientY })
                  }
                  hasMovedRef.current = false
                } else if (isSelectionMode) {
                  if (!isSelected) {
                    setSelectedShapeIds(new Set([shapeId]))
                    setSelectedShapeId(shapeId)
                  }
                }
              }}
            />
          ))}
      </div>
      {/* Rectangle de sélection */}
      {selectionRect && (() => {
        // Obtenir la position réelle du canvas pour calculer correctement la position du rectangle
        const canvas = canvasRef.current
        const canvasRect = canvas ? canvas.getBoundingClientRect() : null
        if (!canvasRect) return null
        
        // Convertir les coordonnées monde en coordonnées écran (relatives au canvas)
        const startScreen = worldToScreen(
          Math.min(selectionRect.startX, selectionRect.endX),
          Math.min(selectionRect.startY, selectionRect.endY),
          toCoordinateViewState(viewState)
        )
        const endScreen = worldToScreen(
          Math.max(selectionRect.startX, selectionRect.endX),
          Math.max(selectionRect.startY, selectionRect.endY),
          toCoordinateViewState(viewState)
        )
        
        // Convertir en coordonnées fixes (ajouter la position du canvas)
        const left = canvasRect.left + startScreen.x
        const top = canvasRect.top + startScreen.y
        const width = endScreen.x - startScreen.x
        const height = endScreen.y - startScreen.y
        
        return (
          <div 
            className="selection-rect"
            style={{
              position: 'fixed',
              left: `${left}px`,
              top: `${top}px`,
              width: `${width}px`,
              height: `${height}px`,
              border: '1px dashed #0066ff',
              backgroundColor: 'rgba(0, 102, 255, 0.1)',
              pointerEvents: 'none',
              zIndex: 1000,
            }}
          />
        )
      })()}
    </div>
  )
})

Canvas.displayName = 'Canvas'

export default Canvas

