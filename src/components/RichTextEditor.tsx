import React, { useRef } from 'react'
import { Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, AlignJustify, RotateCcw } from 'lucide-react'
import './RichTextEditor.css'

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = "Escribe el examen aquí...",
  className = ""
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Función para obtener la selección actual
  const getSelection = () => {
    if (textareaRef.current) {
      const { selectionStart, selectionEnd } = textareaRef.current
      return { start: selectionStart, end: selectionEnd }
    }
    return { start: 0, end: 0 }
  }

  // Función para aplicar formato
  const applyFormat = (format: string) => {
    if (!textareaRef.current) return

    const { start, end } = getSelection()
    const text = value
    const selectedText = text.substring(start, end)
    
    let formattedText = ''
    let newCursorPos = start

    switch (format) {
      case 'bold':
        formattedText = `**${selectedText}**`
        newCursorPos = start + 2
        break
      case 'italic':
        formattedText = `*${selectedText}*`
        newCursorPos = start + 1
        break
      case 'underline':
        formattedText = `__${selectedText}__`
        newCursorPos = start + 2
        break
      case 'align-left':
        formattedText = `<div style="text-align: left;">${selectedText}</div>`
        newCursorPos = start + 25
        break
      case 'align-center':
        formattedText = `<div style="text-align: center;">${selectedText}</div>`
        newCursorPos = start + 27
        break
      case 'align-right':
        formattedText = `<div style="text-align: right;">${selectedText}</div>`
        newCursorPos = start + 26
        break
      case 'align-justify':
        formattedText = `<div style="text-align: justify;">${selectedText}</div>`
        newCursorPos = start + 28
        break
      default:
        return
    }

    const newText = text.substring(0, start) + formattedText + text.substring(end)
    onChange(newText)

    // Restaurar el foco y la posición del cursor
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus()
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos + selectedText.length)
      }
    }, 0)
  }

  // Función para limpiar formato
  const clearFormat = () => {
    if (!textareaRef.current) return

    const { start, end } = getSelection()
    const text = value
    const selectedText = text.substring(start, end)
    
    // Remover formato markdown y HTML
    let cleanText = selectedText
      .replace(/\*\*(.*?)\*\*/g, '$1') // Bold
      .replace(/\*(.*?)\*/g, '$1') // Italic
      .replace(/__(.*?)__/g, '$1') // Underline
      .replace(/<div[^>]*>(.*?)<\/div>/g, '$1') // HTML divs

    const newText = text.substring(0, start) + cleanText + text.substring(end)
    onChange(newText)
  }

  return (
    <div className={`rich-text-editor ${className}`}>
      {/* Barra de herramientas */}
      <div className="toolbar">
        <div className="toolbar-group">
          <button
            type="button"
            onClick={() => applyFormat('bold')}
            className="toolbar-button"
            title="Negrita (Ctrl+B)"
          >
            <Bold className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => applyFormat('italic')}
            className="toolbar-button"
            title="Cursiva (Ctrl+I)"
          >
            <Italic className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => applyFormat('underline')}
            className="toolbar-button"
            title="Subrayado (Ctrl+U)"
          >
            <Underline className="h-4 w-4" />
          </button>
        </div>

        <div className="toolbar-group">
          <button
            type="button"
            onClick={() => applyFormat('align-left')}
            className="toolbar-button"
            title="Alinear a la izquierda"
          >
            <AlignLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => applyFormat('align-center')}
            className="toolbar-button"
            title="Centrar"
          >
            <AlignCenter className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => applyFormat('align-right')}
            className="toolbar-button"
            title="Alinear a la derecha"
          >
            <AlignRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => applyFormat('align-justify')}
            className="toolbar-button"
            title="Justificar"
          >
            <AlignJustify className="h-4 w-4" />
          </button>
        </div>

        <div className="toolbar-group">
          <button
            type="button"
            onClick={clearFormat}
            className="toolbar-button"
            title="Limpiar formato"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Área de texto */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onSelect={getSelection}
        placeholder={placeholder}
        className="editor-textarea"
        rows={12}
      />
    </div>
  )
}

