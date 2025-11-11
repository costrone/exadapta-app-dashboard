import { useState } from 'react'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '../lib/firebase'
import mammoth from 'mammoth'
import { useToast } from '../ui/toast'

type GeneratedItem = {
  stem: string
  options: { key: string; text: string }[]
  correctKey: string
  level: 1|2|3|4|5
}

type AIGeneratorProps = {
  onCreated: (bankId: string) => void
  currentUserId?: string | null
  onHistorySaved?: () => void
}

export function AIGenerator({ onCreated, currentUserId, onHistorySaved } : AIGeneratorProps) {
  const { show } = useToast()
  const [subject, setSubject] = useState('')
  const [name, setName] = useState('Banco IA')
  const [course, setCourse] = useState('')
  const [numQuestions, setNumQuestions] = useState(20)
  const [contents, setContents] = useState('') // Campo de texto para contenidos
  const [contentsFileInfo, setContentsFileInfo] = useState<{ name: string; type: 'docx' | 'pdf' } | null>(null)
  const [extractedContents, setExtractedContents] = useState('') // Texto extraído de archivos
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')

  // Con backend, ya no dependemos de la clave en cliente
  const canUseAI = true
  const canGenerate = subject.trim().length > 0 && course.trim().length > 0 && numQuestions > 0 && !loading

  const MAX_BATCH = 20

  // Funciones para extraer texto de DOCX y PDF
  async function extractTextFromDOCX(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = async (e) => {
        try {
          const arrayBuffer = e.target?.result as ArrayBuffer
          const result = await mammoth.extractRawText({ arrayBuffer })
          const text = result.value
          
          if (!text || text.trim().length === 0) {
            show(`El archivo DOCX no contiene texto legible.`, 'info')
            resolve(`[Archivo DOCX cargado: ${file.name}. No se pudo extraer texto automáticamente.]`)
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

  async function extractTextFromPDF(file: File): Promise<string> {
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
            show(`No se pudo extraer texto legible del PDF.`, 'info')
            resolve(`[Archivo PDF cargado: ${file.name}. No se pudo extraer texto automáticamente.]`)
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

  async function handleContentsFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const nameLower = file.name.toLowerCase()
    const isDocx = nameLower.endsWith('.docx') || nameLower.endsWith('.doc') || 
                   file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                   file.type === 'application/msword'
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
        extracted = await extractTextFromDOCX(file)
        setContentsFileInfo({ name: file.name, type: 'docx' })
        show('DOCX cargado correctamente.', 'success')
      } else {
        extracted = await extractTextFromPDF(file)
        setContentsFileInfo({ name: file.name, type: 'pdf' })
        show('PDF cargado correctamente.', 'success')
      }

      if (extracted && extracted.trim().length > 0) {
        setExtractedContents(extracted.trim())
      }
    } catch (err: any) {
      show('Error al procesar el archivo: ' + (err?.message || 'Error desconocido'), 'error')
      setContentsFileInfo(null)
      setExtractedContents('')
    } finally {
      setLoading(false)
      e.target.value = ''
    }
  }

  function clearContentsFile() {
    setContentsFileInfo(null)
    setExtractedContents('')
  }

  async function generateBatch(batchSize: number, batchIndex: number, totalBatches: number): Promise<GeneratedItem[]> {
    // Combinar contenidos del campo de texto y del archivo cargado
    const allContents = [
      contents.trim(),
      extractedContents.trim()
    ].filter(Boolean).join('\n\n')

    // Construir la parte del prompt sobre contenidos
    let contentsSection = ''
    if (allContents) {
      contentsSection = `\n\nCONTENIDOS ESPECÍFICOS SOBRE LOS QUE GENERAR LAS PREGUNTAS:\n${allContents}\n\nIMPORTANTE: Las preguntas deben estar directamente relacionadas con estos contenidos específicos. Usa estos contenidos como referencia principal para generar preguntas relevantes y precisas.`
    }

    const batchPrompt = `Eres un generador de ítems para docentes en la Región de Murcia (España). Estás creando el lote ${batchIndex + 1} de ${totalBatches}. Genera ${batchSize} preguntas tipo test en español sobre ${subject} para el curso/nivel "${course}", teniendo en cuenta el currículo oficial vigente de la Región de Murcia y las últimas leyes educativas de España y de la propia Región de Murcia.${contentsSection} Cada pregunta debe tener 4 opciones (A-D), indica la correcta en correctKey y asigna un nivel 1-5 según estos criterios:

NIVEL 1 (Muy fácil): Preguntas de memorización básica, reconocimiento de conceptos simples, definiciones directas, hechos concretos. Vocabulario simple y directo. Ejemplo: "¿Cuál es la capital de España?"

NIVEL 2 (Fácil): Comprensión básica, aplicación simple de conceptos aprendidos, identificación de relaciones simples. Requiere entender el concepto pero no aplicarlo de forma compleja. Ejemplo: "Si un objeto se mueve a 10 km/h durante 2 horas, ¿qué distancia recorre?"

NIVEL 3 (Intermedio): Comprensión y aplicación de conceptos, análisis básico, comparación de ideas, resolución de problemas con un paso intermedio. Requiere razonamiento pero con conceptos conocidos. Ejemplo: "¿Qué diferencia hay entre un elemento y un compuesto químico?"

NIVEL 4 (Difícil): Análisis complejo, síntesis de información, aplicación de múltiples conceptos, resolución de problemas con varios pasos. Requiere pensamiento crítico y conexión de ideas. Ejemplo: "Si la población de una ciudad crece un 5% anual y actualmente tiene 100.000 habitantes, ¿cuántos tendrá en 3 años?"

NIVEL 5 (Muy difícil): Evaluación, creación, problemas complejos que requieren múltiples pasos y conceptos avanzados, análisis profundo, aplicación de teoría a situaciones nuevas. Requiere pensamiento crítico avanzado y dominio del tema. Ejemplo: "Explica cómo afectaría al ecosistema marino la desaparición de los arrecifes de coral y qué medidas preventivas se podrían tomar."

Distribuye los niveles de forma equilibrada en cada lote. Evita repetir preguntas de lotes anteriores. Devuelve SOLO JSON válido con esta forma exacta: {"items":[{ "stem":"...", "options":[{"key":"A","text":"..."},{"key":"B","text":"..."},{"key":"C","text":"..."},{"key":"D","text":"..."}], "correctKey":"A|B|C|D", "level":1-5 }...]}`
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject, course, numQuestions: batchSize, promptOverride: batchPrompt })
    })
    if (!res.ok) {
      let msg = `Error ${res.status}`
      try { 
        const j = await res.json()
        if (j?.details) {
          msg = j.details
        } else if (j?.error) {
          msg = j.error + (j.details ? `: ${j.details}` : '')
        } else {
          msg = `Error ${res.status}: ${JSON.stringify(j)}`
        }
      } catch {
        if (res.status === 502) {
          msg = 'El servicio de IA devolvió un 502 (timeout). Intenta con menos preguntas por lote o vuelve a intentar en unos instantes.'
        } else if (res.status === 504) {
          msg = 'La solicitud tardó demasiado. Intenta con menos preguntas o vuelve a intentarlo.'
        } else if (res.status === 503) {
          msg = 'Error de red. Intenta de nuevo en unos momentos.'
        } else {
          msg = `Error ${res.status}`
        }
      }
      throw new Error(msg)
    }
    const data = await res.json()
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
    let parsed: any
    if (data?.items) {
      parsed = data
    } else {
      try { parsed = JSON.parse(text) }
      catch { const match = text.match(/\{[\s\S]*\}/); if (!match) throw new Error('No se pudo parsear la respuesta de IA'); parsed = JSON.parse(match[0]) }
    }
    const items = (parsed.items || []) as GeneratedItem[]
    if (!Array.isArray(items) || items.length === 0) throw new Error('La IA no devolvió ítems en uno de los lotes')
    return items
  }

  async function generateWithAI(): Promise<GeneratedItem[]> {
    const batches = Math.ceil(numQuestions / MAX_BATCH)
    const results: GeneratedItem[] = []
    for (let batchIndex = 0; batchIndex < batches; batchIndex++) {
      const remaining = numQuestions - results.length
      const batchSize = Math.min(MAX_BATCH, remaining)
      const items = await generateBatch(batchSize, batchIndex, batches)
      results.push(...items)
    }
    return results.slice(0, numQuestions)
  }

  async function handleGenerate() {
    setLoading(true)
    setError('')
    try {
      const items = await generateWithAI()
      const bankRef = await addDoc(collection(db, 'banks'), {
        name: name || `Banco IA — ${subject}`,
        subject,
        course,
        scale: { min: 1, max: 5 },
        policy: { minItems: 12, maxItems: 30, stabilizationDelta: 0.20, stabilizationWindow: 5, startLevel: 3, semTarget: 0.30 }
      })
      const bankId = bankRef.id
      for (const it of items) {
        await addDoc(collection(db, 'items'), {
          bankId,
          stem: it.stem,
          options: it.options,
          correctKey: it.correctKey,
          level: Math.min(5, Math.max(1, Number(it.level) || 3)),
          tags: []
        })
      }
      onCreated(bankId)
      if (currentUserId) {
        const summary = `${subject} — ${course}`.trim()
        await addDoc(collection(db, 'generatedAdaptiveExams'), {
          userId: currentUserId,
          bankId,
          title: name || `Banco IA — ${subject}`,
          subject,
          course,
          numQuestions,
          items,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
        onHistorySaved?.()
      }
    } catch (e:any) {
      setError(e?.message || 'Error generando banco')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl border p-4 space-y-3">
      <h3 className="font-semibold">Generar banco con IA</h3>
      {/* Sin aviso: ahora el backend gestiona la API Key */}
      <div className="grid sm:grid-cols-4 gap-3">
        <div className="flex flex-col">
          <label className="block text-sm text-gray-600 mb-1">Asignatura/tema</label>
          <input value={subject} onChange={e=>setSubject(e.target.value)} className="w-full border rounded-lg px-3 py-2 h-10" placeholder="p. ej., historia de España" />
        </div>
        <div className="flex flex-col">
          <label className="block text-sm text-gray-600 mb-1">Nombre del banco</label>
          <input value={name} onChange={e=>setName(e.target.value)} className="w-full border rounded-lg px-3 py-2 h-10" placeholder="Banco IA" />
        </div>
        <div className="flex flex-col">
          <label className="block text-sm text-gray-600 mb-1">Curso/Nivel</label>
          <input value={course} onChange={e=>setCourse(e.target.value)} className="w-full border rounded-lg px-3 py-2 h-10" placeholder="1º ESO, 2º Bach, etc." />
        </div>
        <div className="flex flex-col">
          <label className="block text-sm text-gray-600 mb-1">Número de preguntas</label>
          <input type="number" min={4} max={100} value={numQuestions} onChange={e=>setNumQuestions(Number(e.target.value))} className="w-full border rounded-lg px-3 py-2 h-10" />
        </div>
      </div>
      
      {/* Sección de contenidos */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">Contenidos sobre los que generar las preguntas</label>
        <div className="space-y-2">
          {/* Campo de texto para contenidos */}
          <div>
            <label className="block text-xs text-gray-600 mb-1">Descripción de contenidos (opcional)</label>
            <textarea
              value={contents}
              onChange={e=>setContents(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 min-h-[80px]"
              placeholder="Describe los contenidos específicos sobre los que quieres generar las preguntas. Puedes escribir aquí o cargar un documento DOCX/PDF."
            />
          </div>
          
          {/* Input de archivo */}
          <div>
            <label className="block text-xs text-gray-600 mb-1">
              O carga un documento DOCX/PDF con los contenidos (opcional)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="file"
                accept=".docx,.doc,.pdf"
                onChange={handleContentsFileUpload}
                disabled={loading}
                className="text-sm border rounded-lg px-3 py-2 file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              {contentsFileInfo && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="text-xs">{contentsFileInfo.name}</span>
                  <button
                    type="button"
                    onClick={clearContentsFile}
                    className="text-red-600 hover:text-red-700 text-xs"
                    disabled={loading}
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
            {(contents.trim() || extractedContents.trim()) && (
              <p className="text-xs text-green-600 mt-1">
                ✓ Contenidos cargados. Las preguntas se generarán basándose en estos contenidos.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button disabled={!canGenerate} onClick={handleGenerate} className={"px-4 py-2 rounded-xl border "+(canGenerate?"bg-blue-600 text-white border-blue-600 hover:bg-blue-700":"opacity-50 cursor-not-allowed")}>{loading? 'Generando…' : 'Generar banco'}</button>
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </div>
  )
}


