import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import type { Shape } from '../App'
import './TextBlock.css'

interface TextBlockProps {
  shape: Shape
  isSelected: boolean
  isEditing: boolean
  onDoubleClick: () => void
  onContentChange: (content: string, dimensions?: { width: number; height: number }) => void
  onBlur: () => void
  onMouseDown?: (e: React.MouseEvent, shapeId: string) => void
}

const VERTICAL_PADDING = 24 // padding total (12px haut + 12px bas)

export default function TextBlock({
  shape,
  isSelected,
  isEditing: isEditingProp,
  onDoubleClick,
  onContentChange,
  onBlur,
  onMouseDown
}: TextBlockProps) {
  const [editContent, setEditContent] = useState(shape.content ?? '')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [editingSize, setEditingSize] = useState<{ width: number; height: number } | null>(null)

  useEffect(() => {
    setEditContent(shape.content ?? '')
  }, [shape.content])

  useEffect(() => {
    if (isEditingProp && textareaRef.current) {
      const textarea = textareaRef.current
      textarea.focus()
      const length = textarea.value.length
      textarea.setSelectionRange(length, length)
    }
  }, [isEditingProp])

  useEffect(() => {
    if (!isEditingProp || !textareaRef.current) {
      setEditingSize(null)
      return
    }

    const textarea = textareaRef.current
    textarea.style.height = 'auto'
    const measuredHeight = textarea.scrollHeight + VERTICAL_PADDING
    textarea.style.height = `${textarea.scrollHeight}px`
    setEditingSize({ width: shape.width, height: measuredHeight })
  }, [editContent, isEditingProp, shape.width])

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setEditContent(shape.content ?? '')
    onDoubleClick()
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isEditingProp) {
      e.stopPropagation()
      if (onMouseDown) {
        onMouseDown(e, shape.id)
      }
    }
  }

  const measureContentDimensions = (): { width: number; height: number } => {
    if (textareaRef.current) {
      const textarea = textareaRef.current
      textarea.style.height = 'auto'
      const height = textarea.scrollHeight + VERTICAL_PADDING
      textarea.style.height = `${textarea.scrollHeight}px`
      return { width: shape.width, height }
    }

    if (contentRef.current) {
      const height = contentRef.current.scrollHeight + VERTICAL_PADDING
      return { width: shape.width, height }
    }

    return { width: shape.width, height: shape.height }
  }

  const handleBlur = () => {
    const dimensions = measureContentDimensions()
    onContentChange(editContent, dimensions)
    onBlur()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      handleBlur()
    }
    if (e.key === 'Escape') {
      setEditContent(shape.content ?? '')
      onBlur()
    }
  }

  const hasContent = Boolean((shape.content ?? '').trim())
  const resolvedWidth = Math.max(shape.width, editingSize?.width ?? shape.width)
  const resolvedHeight = Math.max(shape.height, editingSize?.height ?? shape.height)
  const editorMinHeight = Math.max(resolvedHeight - VERTICAL_PADDING, 80)

  return (
    <div
      className={`text-block ${isSelected ? 'text-block-selected' : ''} ${isEditingProp ? 'text-block-editing' : ''}`}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: `${resolvedWidth}px`,
        height: `${resolvedHeight}px`,
        transform: `translate(${shape.x}px, ${shape.y}px)`,
        zIndex: 2,
        cursor: isEditingProp ? 'text' : 'move',
      }}
      onDoubleClick={handleDoubleClick}
      onMouseDown={handleMouseDown}
      data-shape-id={shape.id}
      data-shape-kind="text"
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
            minHeight: `${editorMinHeight}px`,
          }}
        />
      ) : (
        hasContent ? (
          <div ref={contentRef} className="text-block-content">
            <ReactMarkdown>{shape.content ?? ''}</ReactMarkdown>
          </div>
        ) : (
          <div ref={contentRef} className="text-block-placeholder">
            Double-cliquez pour éditer ce bloc
          </div>
        )
      )}
    </div>
  )
}
