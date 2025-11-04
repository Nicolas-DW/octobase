import { useRef } from 'react'
import type { Shape } from '../App'
import './ShapeBlock.css'

interface ShapeBlockProps {
  shape: Shape
  isSelected: boolean
  onMouseDown?: (e: React.MouseEvent, shapeId: string) => void
}

export default function ShapeBlock({
  shape,
  isSelected,
  onMouseDown
}: ShapeBlockProps) {
  const blockRef = useRef<HTMLDivElement>(null)

  if (shape.kind === 'text') {
    return null // Les blocs de texte sont gérés par TextBlock
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation() // Empêcher le pan du canvas
    if (onMouseDown) {
      onMouseDown(e, shape.id)
    }
  }

  return (
    <div
      ref={blockRef}
      className={`shape-block shape-block-${shape.appearance} ${isSelected ? 'shape-block-selected' : ''}`}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: `${shape.width}px`,
        height: `${shape.height}px`,
        transform: `translate(${shape.x}px, ${shape.y}px)`,
        backgroundColor: shape.color,
        zIndex: 1,
      }}
      data-shape-id={shape.id}
      data-shape-type={shape.appearance}
      onMouseDown={handleMouseDown}
    />
  )
}

