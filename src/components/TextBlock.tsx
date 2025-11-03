import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import type { Shape } from '../App'
import './TextBlock.css'

interface TextBlockProps {
  shape: Shape
  isSelected: boolean
  isEditing: boolean
  onDoubleClick: () => void
  onContentChange: (content: string) => void
  onBlur: () => void
  onMouseDown?: (e: React.MouseEvent, shapeId: string) => void
}

export default function TextBlock({
  shape,
  isSelected,
  isEditing: isEditingProp,
  onDoubleClick,
  onContentChange,
  onBlur,
  onMouseDown
}: TextBlockProps) {
  const [editContent, setEditContent] = useState(shape.content || '')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setEditContent(shape.content || '')
  }, [shape.content])

  useEffect(() => {
    if (isEditingProp && textareaRef.current) {
      textareaRef.current.focus()
      // Placer le curseur à la fin du texte
      const length = textareaRef.current.value.length
      textareaRef.current.setSelectionRange(length, length)
    }
  }, [isEditingProp])

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setEditContent(shape.content || '')
    onDoubleClick()
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isEditingProp) {
      e.stopPropagation() // Empêcher le pan du canvas
      if (onMouseDown) {
        onMouseDown(e, shape.id)
      }
    }
  }

  const handleBlur = () => {
    onContentChange(editContent)
    onBlur()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl/Cmd + Enter pour sauvegarder
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      handleBlur()
    }
    // Échapper pour annuler
    if (e.key === 'Escape') {
      setEditContent(shape.content || '')
      onBlur()
    }
  }

  // Position en coordonnées monde - la transformation sera appliquée par le parent
  return (
    <div
      className={`text-block ${isSelected ? 'text-block-selected' : ''} ${isEditingProp ? 'text-block-editing' : ''}`}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: `${shape.width}px`,
        minHeight: `${shape.height}px`,
        transform: `translate(${shape.x}px, ${shape.y}px)`,
        zIndex: 2,
      }}
      onDoubleClick={handleDoubleClick}
      onMouseDown={handleMouseDown}
      data-shape-id={shape.id}
      data-shape-type="text"
    >
      {isEditingProp ? (
        <textarea
          ref={textareaRef}
          className="text-block-editor"
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          style={{
            fontSize: '14px',
            lineHeight: '1.6',
          }}
        />
      ) : (
        <div className="text-block-content">
          <ReactMarkdown>{shape.content || ''}</ReactMarkdown>
        </div>
      )}
    </div>
  )
}

