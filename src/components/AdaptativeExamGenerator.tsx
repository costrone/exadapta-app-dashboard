import { useEffect, useState } from 'react'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Textarea } from '../ui/Textarea'
import { Select } from '../ui/Select'
import { useToast } from '../ui/toast'
import mammoth from 'mammoth'
import { saveAs } from 'file-saver'
import { RichTextEditor } from './RichTextEditor'
import { collection, addDoc, updateDoc, doc as firestoreDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { createExamDoc } from '../utils/examDoc'
import { GeneratedExamRecord, StoredFileInfo } from '../types/generatedExam'

type QuestionType = 'test' | 'desarrollo' | 'mixto'
type ExamInputMode = 'docx' | 'editor'

type AdaptativeExamGeneratorProps = {
  userId?: string | null
  editingEntry?: GeneratedExamRecord | null
  onHistorySaved?: () => void
  onEditCleared?: () => void
  onGenerated?: (examContent: string) => void
}

export function AdaptativeExamGenerator({
  userId,
  editingEntry,
  onHistorySaved,
  onEditCleared,
  onGenerated,
}: AdaptativeExamGeneratorProps) {
  const { show } = useToast()
  const [titulo, setTitulo] = useState('')
  const [materia, setMateria] = useState('')
  const [contenidos, setContenidos] = useState('')
  const [contenidosFileInfo, setContenidosFileInfo] = useState<StoredFileInfo | null>(null)
  const [numPreguntas, setNumPreguntas] = useState(10)
  const [tipoPreguntas, setTipoPreguntas] = useState<QuestionType>('test')
  const [necesidades, setNecesidades] = useState('')
  const [examInputMode, setExamInputMode] = useState<ExamInputMode>('docx')
  const [docxFile, setDocxFile] = useState<File | null>(null)
  const [docxText, setDocxText] = useState('')
  const [docxSourceName, setDocxSourceName] = useState<string | null>(null)
  const [editorText, setEditorText] = useState('')
  const [docFontFamily, setDocFontFamily] = useState<
    | 'Arial'
    | 'Calibri'
    | 'Century Gothic'
    | 'Open Sans'
    | 'Tahoma'
    | 'Times New Roman'
    | 'Verdana'
    | 'OpenDyslexic'
  >('Arial')
  const [docFontSize, setDocFontSize] = useState<number>(12)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [generatedExam, setGeneratedExam] = useState<string>('')
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null)
  const [currentCreatedAt, setCurrentCreatedAt] = useState<Date | null>(null)

  useEffect(() => {
    if (editingEntry) {
      setTitulo(editingEntry.title || '')
      setMateria(editingEntry.subject || '')
      setContenidos(editingEntry.contents || '')
      setTipoPreguntas(editingEntry.tipoPreguntas || 'test')
      setNumPreguntas(editingEntry.numPreguntas || 10)
      setNecesidades(editingEntry.necesidades || '')
      setDocFontFamily(
        (editingEntry.fontFamily as typeof docFontFamily) || 'Arial'
      )
      setDocFontSize(editingEntry.fontSize || 12)
      setGeneratedExam(editingEntry.examText || '')
      setExamInputMode(editingEntry.sourceMode || 'docx')
      setDocxText(editingEntry.docxText || '')
      setEditorText(editingEntry.editorText || '')
      setContenidosFileInfo(editingEntry.contenidosFileInfo || null)
      setDocxSourceName(editingEntry.docxFileName || null)
      setDocxFile(null)
      setActiveHistoryId(editingEntry.id)
      setCurrentCreatedAt(
        editingEntry.createdAt?.toDate?.() || new Date()
      )
    } else {
      setActiveHistoryId(null)
      setCurrentCreatedAt(null)
      setDocxSourceName(null)
      setDocxFile(null)
    }
  }, [editingEntry])

  const canGenerate =
    titulo.trim().length > 0 &&
    materia.trim().length > 0 &&
    contenidos.trim().length > 0 &&
    numPreguntas > 0 &&
    !loading

  async function extractTextFromDOCX(file: File, context: 'exam' | 'content' = 'exam'): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = async (e) => {
        try {
          const arrayBuffer = e.target?.result as ArrayBuffer
          const result = await mammoth.extractRawText({ arrayBuffer })
          const text = result.value
          
          if (!text || text.trim().length === 0) {
            const originLabel = context === 'exam' ? 'del examen original' : 'de los contenidos'
            show(`El archivo DOCX ${originLabel} no contiene texto legible. Asegúrate de que el documento tenga contenido.`, 'info')
            resolve(`[Archivo DOCX cargado: ${file.name}. No se pudo extraer texto automáticamente. Por favor, escribe un resumen manual para completar la información.]`)
            return
          }
          
          resolve(text)
        } catch (err: any) {
          show('Error al procesar el DOCX: ' + (err?.message || 'Error desconocido'), 'error')
          reject(new Error('Error al procesar el archivo DOCX'))
        }
      }
      reader.onerror = () => {
        show('Error al leer el archivo DOCX', 'error')
        reject(new Error('Error al leer el archivo'))
      }
      reader.readAsArrayBuffer(file)
    })
  }

  async function extractTextFromPDF(file: File, context: 'exam' | 'content' = 'exam'): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = async (e) => {
        try {
          const pdfModule: any = await import('pdfjs-dist')
          const pdfjs = pdfModule?.default ?? pdfModule
          if (pdfjs?.GlobalWorkerOptions) {
            const version = pdfjs.version || '5.4.394'
            pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/pdf.worker.min.js`
          }
          const pdf = await pdfjs.getDocument({ data: e.target?.result as ArrayBuffer }).promise
          let text = ''

          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i)
            const textContent = await page.getTextContent()
            text += textContent.items.map((item: any) => item.str || '').join(' ') + '\n'
          }

          if (!text || text.trim().length === 0) {
            const originLabel = context === 'exam' ? 'del examen original' : 'de los contenidos'
            show(`No se pudo extraer texto legible del PDF ${originLabel}.`, 'info')
            resolve(`[Archivo PDF cargado: ${file.name}. No se pudo extraer texto automáticamente. Describe el contenido manualmente para mejorar la adaptación.]`)
            return
          }

          resolve(text)
        } catch (err: any) {
          reject(new Error(err?.message || 'Error al procesar el PDF'))
        }
      }
      reader.onerror = () => reject(new Error('Error al leer el archivo PDF'))
      reader.readAsArrayBuffer(file)
    })
  }

  async function handleDocxUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    
    // Verificar que sea un archivo DOCX
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword'
    ]
    const validExtensions = ['.docx', '.doc']
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'))
    
    if (!validTypes.includes(file.type) && !validExtensions.includes(fileExtension)) {
      show('Por favor, selecciona un archivo DOCX o DOC', 'error')
      return
    }
    
    setDocxFile(file)
    setLoading(true)
    try {
      const text = await extractTextFromDOCX(file, 'exam')
      setDocxText(text)
      setDocxSourceName(file.name)
      show('DOCX del examen original cargado correctamente.', 'success')
    } catch (err: any) {
      show('Error al procesar el DOCX: ' + (err?.message || 'Error desconocido'), 'error')
      setDocxFile(null)
    } finally {
      setLoading(false)
    }
  }

  async function handleContenidosFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const nameLower = file.name.toLowerCase()
    const isDocx = nameLower.endsWith('.docx') || nameLower.endsWith('.doc')
    const isPdf = nameLower.endsWith('.pdf') || file.type === 'application/pdf'

    if (!isDocx && !isPdf) {
      show('Formato no soportado. Carga un archivo DOCX o PDF.', 'error')
      e.target.value = ''
      return
    }

    setLoading(true)
    try {
      let extracted = ''
      if (isDocx) {
        extracted = await extractTextFromDOCX(file, 'content')
        setContenidosFileInfo({ name: file.name, type: 'docx' })
        show('DOCX de contenidos cargado correctamente.', 'success')
      } else {
        extracted = await extractTextFromPDF(file, 'content')
        setContenidosFileInfo({ name: file.name, type: 'pdf' })
        show('PDF de contenidos cargado correctamente.', 'success')
      }

      if (extracted && extracted.trim().length > 0) {
        setContenidos(extracted.trim())
      }
    } catch (err: any) {
      show('Error al procesar el archivo: ' + (err?.message || 'Error desconocido'), 'error')
      setContenidosFileInfo(null)
    } finally {
      setLoading(false)
      e.target.value = ''
    }
  }

  function clearContenidosFile() {
    setContenidosFileInfo(null)
  }

  function handleCancelEdit() {
    setActiveHistoryId(null)
    setCurrentCreatedAt(null)
    setDocxSourceName(null)
    onEditCleared?.()
  }

  function summarize(text: string, fallback: string): string {
    const clean = text.replace(/\s+/g, ' ').trim()
    if (clean.length === 0) return fallback
    return clean.length > 160 ? `${clean.slice(0, 157)}…` : clean
  }

  async function upsertHistory(examText: string) {
    if (!userId) return
    const summarySource = contenidos.trim() || examText
    const summary = summarize(summarySource, 'Sin descripción')
    const baseTitle =
      titulo.trim() || (materia ? `${materia} — ${summary}` : summary)
    const resolvedTitle = summarize(baseTitle, 'Examen adaptado')
    const now = new Date()
    const payload = {
      userId,
      title: resolvedTitle,
      subject: materia,
      summary,
      contents: contenidos,
      tipoPreguntas,
      numPreguntas,
      necesidades,
      examText,
      fontFamily: docFontFamily,
      fontSize: docFontSize,
      sourceMode: examInputMode,
      docxText: docxText || '',
      editorText: editorText || '',
      docxFileName: docxSourceName || null,
      contenidosFileInfo: contenidosFileInfo || null,
      updatedAt: serverTimestamp(),
    }

    if (activeHistoryId) {
      await updateDoc(firestoreDoc(db, 'generatedExams', activeHistoryId), payload)
    } else {
      const docRef = await addDoc(collection(db, 'generatedExams'), {
        ...payload,
        createdAt: serverTimestamp(),
      })
      setActiveHistoryId(docRef.id)
      setCurrentCreatedAt(now)
    }
    onHistorySaved?.()
  }

  // Función para limpiar formato markdown del texto del editor
  function cleanMarkdown(text: string): string {
    return text
      .replace(/\*\*(.*?)\*\*/g, '$1') // Bold
      .replace(/\*(.*?)\*/g, '$1') // Italic
      .replace(/__(.*?)__/g, '$1') // Underline
      .replace(/<div[^>]*>(.*?)<\/div>/g, '$1') // HTML divs
      .trim()
  }

  async function loadImageBytes(path: string): Promise<Uint8Array | null> {
    try {
      const res = await fetch(path)
      if (!res.ok) return null
      const blob = await res.blob()
      const buffer = await blob.arrayBuffer()
      return new Uint8Array(buffer)
    } catch {
      return null
    }
  }

  async function generateExam() {
    setLoading(true)
    setError('')
    setGeneratedExam('')
    
    try {
      // Determinar qué texto usar: editor tiene prioridad sobre DOCX
      // Si viene del editor, limpiar el formato markdown
      const examTextToUse = examInputMode === 'editor' && editorText.trim() 
        ? cleanMarkdown(editorText) 
        : docxText.trim()

      // Construir el prompt según los datos proporcionados
      let prompt = `Eres un generador de exámenes para docentes de la ESO en la Región de Murcia (España). 
      
Materia: ${materia}
Contenidos del examen: ${contenidos}
Número de preguntas: ${numPreguntas}
Tipo de preguntas: ${tipoPreguntas === 'test' ? 'Preguntas tipo test con 4 opciones (A-D)' : tipoPreguntas === 'desarrollo' ? 'Preguntas de desarrollo' : 'Preguntas mixtas (test y desarrollo)'}
Necesidades del alumno: ${necesidades || 'No se especificaron necesidades especiales'}

${examTextToUse ? `\n=== EXAMEN ORIGINAL ${examInputMode === 'editor' ? '(ESCRITO EN LA APP)' : 'EN DOCX'} ===
El profesor ha ${examInputMode === 'editor' ? 'escrito' : 'cargado'} un examen original${examInputMode === 'editor' ? ' directamente en la aplicación' : ' en formato DOCX'}. A continuación está el texto completo${examInputMode === 'editor' ? ' escrito' : ' extraído del documento'}:

${examTextToUse}

=== FIN DEL EXAMEN ORIGINAL ===

INSTRUCCIONES PARA LA ADAPTACIÓN:
1. Lee y comprende completamente el contenido del examen original mostrado arriba
2. Identifica los temas, conceptos y tipo de preguntas del examen original
3. Adapta el examen manteniendo la misma estructura y temática, pero ajustándolo a las necesidades específicas del alumno mencionadas anteriormente
4. Modifica la dificultad, vocabulario, complejidad y formato según las necesidades del alumno
5. Si el examen original tiene preguntas de desarrollo, mantén ese formato pero simplifica o adapta según sea necesario
6. Si el examen original tiene preguntas tipo test, mantén ese formato pero ajusta la dificultad de las opciones
7. Genera exactamente ${numPreguntas} preguntas adaptadas basadas en el contenido del examen original

IMPORTANTE: El examen generado debe estar basado en el contenido ${examInputMode === 'editor' ? 'escrito' : 'del DOCX'} mostrado arriba, no inventes temas nuevos que no estén en el examen original.\n` : ''}

${!examTextToUse ? `Genera un examen completo adaptado a las necesidades del alumno, teniendo en cuenta:
- El currículo oficial vigente de la Región de Murcia
- Las últimas leyes educativas de España y de la Región de Murcia
- Las necesidades específicas del alumno mencionadas
- El nivel educativo de la ESO
- Ajusta la dificultad, vocabulario y profundidad según las necesidades\n` : ''}

${tipoPreguntas === 'test' ? 'Devuelve SOLO JSON válido con esta forma exacta: {"items":[{"stem":"...", "options":[{"key":"A","text":"..."},{"key":"B","text":"..."},{"key":"C","text":"..."},{"key":"D","text":"..."}], "correctKey":"A|B|C|D"}]}' : 'Devuelve el examen en formato texto estructurado con las preguntas y, si aplica, las respuestas esperadas. Formatea el texto de manera clara y profesional, separando cada pregunta claramente con números o viñetas.'}`

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          subject: materia,
          course: 'ESO',
          numQuestions: numPreguntas,
          promptOverride: prompt,
          returnText: tipoPreguntas !== 'test' // Si no es test, devolver texto
        })
      })

      if (!res.ok) {
        let msg = `Error ${res.status}`
        try {
          const j = await res.json()
          if (j?.details) {
            msg = j.details
          } else if (j?.error) {
            msg = j.error + (j.details ? `: ${j.details}` : '')
          }
        } catch {
          if (res.status === 502) {
            msg = 'Error de conexión con el servicio de IA. Verifica que la función esté desplegada y la API key configurada.'
          } else if (res.status === 504) {
            msg = 'La solicitud tardó demasiado. Intenta con menos preguntas o vuelve a intentarlo.'
          } else if (res.status === 503) {
            msg = 'Error de red. Intenta de nuevo en unos momentos.'
          }
        }
        throw new Error(msg)
      }

      const data = await res.json()
      
      let examText = ''
      if (tipoPreguntas === 'test' && data?.items) {
        // Formatear como examen tipo test
        examText = data.items.map((item: any, idx: number) => {
          const options = item.options.map((opt: any) => `  ${opt.key}. ${opt.text}`).join('\n')
          return `${idx + 1}. ${item.stem}\n${options}\nRespuesta correcta: ${item.correctKey}\n`
        }).join('\n')
      } else if (data?.text) {
        // Para otros tipos, usar el texto directamente del campo text
        examText = data.text
      } else if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
        // Fallback: intentar obtener texto de candidates
        examText = data.candidates[0].content.parts[0].text
      } else {
        // Último recurso: mostrar datos en formato legible
        examText = JSON.stringify(data, null, 2)
      }
      
      setGeneratedExam(examText)
      setCurrentCreatedAt((prev) => prev ?? new Date())
      onGenerated?.(examText || data)
      try {
        await upsertHistory(examText)
      } catch (historyError) {
        console.error('Error guardando examen en el historial:', historyError)
        show(
          'El examen se generó correctamente, pero no se pudo almacenar en el historial.',
          'error'
        )
      }
      show('Examen generado correctamente', 'success')
    } catch (e: any) {
      setError(e?.message || 'Error generando examen')
      show(e?.message || 'Error generando examen', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function downloadExam() {
    if (!generatedExam) {
      show('Genera el examen antes de descargarlo.', 'info')
      return
    }

    try {
      setLoading(true)
      const blob = await createExamDoc({
        examText: generatedExam,
        subject: materia,
        fontFamily: docFontFamily,
        fontSize: docFontSize,
        tipoPreguntas,
        createdAt: currentCreatedAt ?? new Date(),
      })
      const fileName = `examen_adaptado_${(materia || 'examen')
        .replace(/\s+/g, '_')
        .toLowerCase()}_${new Date().toISOString().split('T')[0]}.docx`
      saveAs(blob, fileName)
      show('Examen descargado en formato DOCX', 'success')
    } catch (err: any) {
      show('Error al generar el documento DOCX: ' + (err?.message || 'Error desconocido'), 'error')
      console.error('Error generando DOCX:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border p-4 space-y-4">
        <h3 className="text-xl font-semibold">Generador de Exámenes Adaptados</h3>
        <p className="text-sm text-gray-600">
          Completa los siguientes campos para generar un examen adaptado a las necesidades de tu alumno.
        </p>

        {activeHistoryId && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-blue-200 bg-blue-50/70 px-3 py-2 text-sm text-blue-900 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-200">
            <span>
              Estás editando un examen guardado
              {currentCreatedAt
                ? ` (${currentCreatedAt.toLocaleDateString('es-ES')})`
                : ''}.
            </span>
            <Button variant="ghost" size="sm" onClick={handleCancelEdit}>
              Cancelar edición
            </Button>
          </div>
        )}

        <div>
          <label className="block text-sm text-gray-600 mb-1">Título del examen *</label>
          <Input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Examen adaptado — Tema, unidad o descripción breve"
            className="w-full"
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Materia *</label>
            <Input 
              value={materia} 
              onChange={e => setMateria(e.target.value)} 
              placeholder="p. ej., Matemáticas, Lengua, Historia..."
              className="w-full"
            />
          </div>
          
          <div>
            <label className="block text-sm text-gray-600 mb-1">Número de preguntas *</label>
            <Input 
              type="number" 
              min={1} 
              max={50} 
              value={numPreguntas} 
              onChange={e => setNumPreguntas(Number(e.target.value))} 
              className="w-full"
            />
          </div>
        </div>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
            <label className="block text-sm text-gray-600">Contenidos del examen *</label>
            <div className="flex items-center gap-2 text-xs">
              <label className="inline-flex items-center gap-1 rounded-md border border-dashed border-blue-300 px-3 py-1 text-blue-600 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/40">
                Importar DOCX/PDF
                <input
                  type="file"
                  accept=".doc,.docx,.pdf"
                  className="hidden"
                  onChange={handleContenidosFileUpload}
                  disabled={loading}
                />
              </label>
              {contenidosFileInfo && (
                <button
                  type="button"
                  onClick={clearContenidosFile}
                  className="rounded-md border px-2 py-1 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  Quitar archivo
                </button>
              )}
            </div>
          </div>
          <Textarea 
            value={contenidos} 
            onChange={e => setContenidos(e.target.value)} 
            placeholder="Describe los contenidos que debe cubrir el examen (temas, unidades, competencias...)"
            rows={3}
            className="w-full"
          />
          {contenidosFileInfo && (
            <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between">
                <strong className="text-xs text-blue-700 dark:text-blue-300">
                  Archivo importado: {contenidosFileInfo.name} ({contenidosFileInfo.type.toUpperCase()})
                </strong>
              </div>
              <div className="mt-2 text-xs text-gray-700 dark:text-gray-300 max-h-32 overflow-auto bg-white dark:bg-gray-800 p-2 rounded border">
                <pre className="whitespace-pre-wrap font-mono">{contenidos.substring(0, 600)}{contenidos.length > 600 ? '...' : ''}</pre>
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">Tipo de preguntas *</label>
          <Select 
            value={tipoPreguntas} 
            onChange={e => setTipoPreguntas(e.target.value as QuestionType)}
            className="w-full"
          >
            <option value="test">Test (opción múltiple)</option>
            <option value="desarrollo">Desarrollo</option>
            <option value="mixto">Mixto (test y desarrollo)</option>
          </Select>
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">Necesidades del alumno</label>
          <Textarea 
            value={necesidades} 
            onChange={e => setNecesidades(e.target.value)} 
            placeholder="Describe las necesidades específicas del alumno (dificultades de aprendizaje, adaptaciones curriculares, nivel de competencia, etc.)"
            rows={3}
            className="w-full"
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Fuente del documento</label>
            <Select
              value={docFontFamily}
              onChange={e => setDocFontFamily(e.target.value as typeof docFontFamily)}
              className="w-full"
            >
              <option value="Arial">Arial</option>
              <option value="Calibri">Calibri</option>
              <option value="Century Gothic">Century Gothic</option>
              <option value="Open Sans">Open Sans</option>
              <option value="Tahoma">Tahoma</option>
              <option value="Times New Roman">Times New Roman</option>
              <option value="Verdana">Verdana</option>
              <option value="OpenDyslexic">OpenDyslexic</option>
            </Select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Tamaño base de letra</label>
            <Select
              value={String(docFontSize)}
              onChange={e => setDocFontSize(Number(e.target.value))}
              className="w-full"
            >
              <option value="10">10 pt</option>
              <option value="11">11 pt</option>
              <option value="12">12 pt</option>
              <option value="13">13 pt</option>
              <option value="14">14 pt</option>
              <option value="15">15 pt</option>
              <option value="16">16 pt</option>
            </Select>
          </div>
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-2">Examen original (opcional)</label>
          
          {/* Selector de modo */}
          <div className="flex gap-2 mb-3">
            <button
              type="button"
              onClick={() => {
                setExamInputMode('docx')
                setEditorText('')
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                examInputMode === 'docx'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              Cargar DOCX
            </button>
            <button
              type="button"
              onClick={() => {
                setExamInputMode('editor')
                setDocxFile(null)
                setDocxText('')
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                examInputMode === 'editor'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              Escribir examen
            </button>
          </div>

          {/* Cargar DOCX */}
          {examInputMode === 'docx' && (
            <div>
              <div className="flex items-center gap-2">
                <input 
                  type="file" 
                  accept=".docx,.doc" 
                  onChange={handleDocxUpload}
                  className="text-sm"
                  disabled={loading}
                />
            {(docxFile || docxSourceName) && (
              <span className="text-sm text-green-600">
                ✓ {docxFile?.name || docxSourceName}
              </span>
            )}
              </div>
              {docxText && (
                <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center justify-between mb-2">
                    <strong className="text-sm text-blue-700 dark:text-blue-300">
                      ✓ Texto extraído del DOCX ({docxText.length} caracteres)
                    </strong>
                  </div>
                  <div className="text-xs text-gray-700 dark:text-gray-300 max-h-40 overflow-auto bg-white dark:bg-gray-800 p-2 rounded border">
                    <pre className="whitespace-pre-wrap font-mono">{docxText.substring(0, 500)}{docxText.length > 500 ? '...' : ''}</pre>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Editor de texto */}
          {examInputMode === 'editor' && (
            <div>
              <RichTextEditor
                value={editorText}
                onChange={setEditorText}
                placeholder="Escribe aquí el contenido del examen original que deseas adaptar..."
                className="w-full"
              />
              {editorText.trim() && (
                <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                  {editorText.length} caracteres escritos
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button 
            disabled={!canGenerate} 
            onClick={generateExam} 
            variant={canGenerate ? 'primary' : 'ghost'}
          >
            {loading ? 'Generando...' : 'Generar Examen Adaptado'}
          </Button>
          {error && <span className="text-sm text-red-600">{error}</span>}
        </div>
      </div>

      {generatedExam && (
        <div className="rounded-xl border p-4 space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">Examen Generado</h3>
            <Button onClick={downloadExam} variant="outline" size="sm" disabled={loading}>
              {loading ? 'Generando DOCX...' : 'Descargar DOCX'}
            </Button>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg max-h-96 overflow-auto">
            <pre className="whitespace-pre-wrap text-sm">{generatedExam}</pre>
          </div>
        </div>
      )}
    </div>
  )
}
