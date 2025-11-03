import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react'
import type { Shape } from '../App'
import './Canvas.css'

interface CanvasProps {
  shapes: Shape[]
  onContextMenu?: (worldX: number, worldY: number, clientX: number, clientY: number) => void
  onShapeMove?: (shapeId: string, newX: number, newY: number) => void
  onViewStateChange?: (viewState: ViewState) => void
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
}

const Canvas = forwardRef<CanvasHandle, CanvasProps>(({ shapes, onContextMenu, onShapeMove, onViewStateChange }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [viewState, setViewState] = useState<ViewState>({ x: 0, y: 0, zoom: 1 })
  const [isPanning, setIsPanning] = useState(false)
  const [lastPanPoint, setLastPanPoint] = useState({ x: 0, y: 0 })
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null)
  const [isDraggingShape, setIsDraggingShape] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const lastTouchDistanceRef = useRef<number | null>(null)

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

  // Fonction pour recentrer la vue sur toutes les formes
  const fitToView = () => {
    if (shapes.length === 0) {
      // Si aucune forme, recentrer à l'origine
      setViewState({ x: 0, y: 0, zoom: 1 })
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
  }))

  // Notifier les changements de vue avec debounce
  useEffect(() => {
    if (!onViewStateChange) return

    const timeoutId = setTimeout(() => {
      onViewStateChange(viewState)
    }, 300) // Debounce de 300ms pour éviter trop de notifications

    return () => clearTimeout(timeoutId)
  }, [viewState, onViewStateChange])

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

        if (clickedShape && onShapeMove) {
          // Commencer le déplacement de la forme
          setSelectedShapeId(clickedShape.id)
          setIsDraggingShape(true)
          // Calculer l'offset entre le point de clic et la position de la forme
          setDragOffset({
            x: worldX - clickedShape.x,
            y: worldY - clickedShape.y,
          })
          setLastPanPoint({ x: e.clientX, y: e.clientY })
        } else {
          // Désélectionner si on clique en dehors
          setSelectedShapeId(null)
          // Pan normal
          setIsPanning(true)
          setLastPanPoint({ x: e.clientX, y: e.clientY })
        }
      } else if (e.button === 1) {
        // Clic milieu - Pan
        e.preventDefault()
        setIsPanning(true)
        setLastPanPoint({ x: e.clientX, y: e.clientY })
      }
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingShape && selectedShapeId && onShapeMove) {
        // Déplacer la forme
        const rect = canvas.getBoundingClientRect()
        const mouseX = e.clientX - rect.left
        const mouseY = e.clientY - rect.top

        // Convertir les coordonnées en coordonnées du monde
        const worldX = (mouseX - viewState.x) / viewState.zoom
        const worldY = (mouseY - viewState.y) / viewState.zoom

        // Mettre à jour la position de la forme en soustrayant l'offset
        const newX = worldX - dragOffset.x
        const newY = worldY - dragOffset.y

        onShapeMove(selectedShapeId, newX, newY)
      } else if (isPanning) {
        const dx = e.clientX - lastPanPoint.x
        const dy = e.clientY - lastPanPoint.y
        setViewState((prev: ViewState) => ({
          ...prev,
          x: prev.x + dx,
          y: prev.y + dy,
        }))
        setLastPanPoint({ x: e.clientX, y: e.clientY })
      }
    }

    const handleMouseUp = () => {
      setIsPanning(false)
      setIsDraggingShape(false)
      setDragOffset({ x: 0, y: 0 })
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
  }, [viewState, isPanning, isDraggingShape, selectedShapeId, dragOffset, shapes, onContextMenu, onShapeMove])

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

    // Fonction de rendu
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Transformer le contexte selon la vue
      ctx.save()
      ctx.translate(viewState.x, viewState.y)
      ctx.scale(viewState.zoom, viewState.zoom)

      // Dessiner un fond avec grille subtile pour visualiser le pan
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(-10000, -10000, 20000, 20000)

      // Grille subtile
      ctx.strokeStyle = '#f0f0f0'
      ctx.lineWidth = 1 / viewState.zoom
      const gridSize = 50

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

      // Dessiner les formes
      shapes.forEach((shape) => {
        const isSelected = shape.id === selectedShapeId
        
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
  }, [viewState, shapes, selectedShapeId])

  return (
    <canvas
      ref={canvasRef}
      className="canvas"
      style={{ cursor: isDraggingShape ? 'grabbing' : isPanning ? 'grabbing' : 'grab' }}
    />
  )
})

Canvas.displayName = 'Canvas'

export default Canvas

