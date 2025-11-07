import { useState } from 'react'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Textarea } from '../ui/Textarea'
import { Select } from '../ui/Select'
import { useToast } from '../ui/toast'
import mammoth from 'mammoth'
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, WidthType } from 'docx'
import { saveAs } from 'file-saver'
import { RichTextEditor } from './RichTextEditor'

type QuestionType = 'test' | 'desarrollo' | 'mixto'
type ExamInputMode = 'docx' | 'editor'

export function AdaptativeExamGenerator({ onGenerated }: { onGenerated?: (examContent: string) => void }) {
  const { show } = useToast()
  const [materia, setMateria] = useState('')
  const [contenidos, setContenidos] = useState('')
  const [numPreguntas, setNumPreguntas] = useState(10)
  const [tipoPreguntas, setTipoPreguntas] = useState<QuestionType>('test')
  const [necesidades, setNecesidades] = useState('')
  const [examInputMode, setExamInputMode] = useState<ExamInputMode>('docx')
  const [docxFile, setDocxFile] = useState<File | null>(null)
  const [docxText, setDocxText] = useState('')
  const [editorText, setEditorText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [generatedExam, setGeneratedExam] = useState<string>('')

  const canGenerate = materia.trim().length > 0 && contenidos.trim().length > 0 && numPreguntas > 0 && !loading

  async function extractTextFromDOCX(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = async (e) => {
        try {
          const arrayBuffer = e.target?.result as ArrayBuffer
          const result = await mammoth.extractRawText({ arrayBuffer })
          const text = result.value
          
          if (!text || text.trim().length === 0) {
            show('El archivo DOCX no contiene texto legible. Asegúrate de que el documento tenga contenido.', 'info')
            resolve(`[Archivo DOCX cargado: ${file.name}. El contenido no pudo ser extraído completamente. Por favor, describe el contenido en el campo "Contenidos del examen" para una mejor adaptación.]`)
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
      const text = await extractTextFromDOCX(file)
      setDocxText(text)
      show('DOCX cargado correctamente. Texto extraído: ' + text.substring(0, 100) + '...', 'success')
    } catch (err: any) {
      show('Error al procesar el DOCX: ' + (err?.message || 'Error desconocido'), 'error')
      setDocxFile(null)
    } finally {
      setLoading(false)
    }
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
      onGenerated?.(examText || data)
      show('Examen generado correctamente', 'success')
    } catch (e: any) {
      setError(e?.message || 'Error generando examen')
      show(e?.message || 'Error generando examen', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function downloadExam() {
    if (!generatedExam) return
    
    try {
      setLoading(true)
      
      const fecha = new Date().toLocaleDateString('es-ES', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })
      
      const children: Paragraph[] = []
      
      // Título principal
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `EXAMEN ADAPTADO`,
              bold: true,
              size: 36,
              color: '004379',
            }),
          ],
          heading: HeadingLevel.TITLE,
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
        })
      )
      
      // Materia
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: materia || 'Sin materia',
              bold: true,
              size: 28,
              color: '004379',
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 300 },
        })
      )
      
      // Fecha
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Fecha: ${fecha}`,
              size: 20,
              color: '666666',
              italics: true,
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
        })
      )
      
      // Contenido del examen
      if (tipoPreguntas === 'test' && generatedExam.includes('Respuesta correcta:')) {
        // Formatear preguntas tipo test
        const questions = generatedExam.split(/\n(?=\d+\.)/).filter(q => q.trim())
        
        questions.forEach((question, idx) => {
          const lines = question.split('\n').filter(l => l.trim())
          if (lines.length === 0) return
          
          // Número y pregunta
          const questionLine = lines[0]
          const questionText = questionLine.replace(/^\d+\.\s*/, '')
          
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `${idx + 1}. `,
                  bold: true,
                  size: 24,
                  color: '004379',
                }),
                new TextRun({
                  text: questionText,
                  bold: true,
                  size: 24,
                }),
              ],
              spacing: { before: 240, after: 160 },
            })
          )
          
          // Opciones
          const options = lines.slice(1).filter(l => !l.includes('Respuesta correcta:'))
          options.forEach(option => {
            const trimmedOption = option.trim()
            // Extraer la letra de la opción (A, B, C, D) y el texto
            const match = trimmedOption.match(/^([A-D])[\.\)]\s*(.+)$/)
            if (match) {
              const [, letter, text] = match
              children.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `${letter}. `,
                      bold: true,
                      size: 22,
                      color: '333333',
                    }),
                    new TextRun({
                      text: text,
                      size: 22,
                    }),
                  ],
                  spacing: { after: 120 },
                  indent: { left: 720 }, // 0.5 pulgadas
                })
              )
            } else {
              children.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: trimmedOption,
                      size: 22,
                    }),
                  ],
                  spacing: { after: 120 },
                  indent: { left: 720 },
                })
              )
            }
          })
          
          // Respuesta correcta (solo para el profesor, no mostrar en examen para alumnos)
          // Comentado para no incluir respuestas en el examen
          /*
          const answerLine = lines.find(l => l.includes('Respuesta correcta:'))
          if (answerLine) {
            children.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: answerLine.replace('Respuesta correcta:', 'Respuesta correcta:').trim(),
                    bold: true,
                    color: '007D57',
                    size: 20,
                  }),
                ],
                spacing: { before: 100, after: 300 },
              })
            )
          }
          */
          
          // Espaciado después de cada pregunta
          children.push(
            new Paragraph({
              text: '',
              spacing: { after: 200 },
            })
          )
        })
      } else {
        // Formatear texto de desarrollo o mixto
        const paragraphs = generatedExam.split('\n').filter(p => p.trim())
        
        paragraphs.forEach((para, idx) => {
          const trimmedPara = para.trim()
          if (!trimmedPara) return
          
          // Detectar títulos (líneas que terminan sin punto y son cortas)
          const isTitle = trimmedPara.length < 80 && !trimmedPara.includes('.') && idx < paragraphs.length - 1
          
          if (isTitle) {
            children.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: trimmedPara,
                    bold: true,
                    size: 26,
                    color: '004379',
                  }),
                ],
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 300, after: 200 },
              })
            )
          } else {
            children.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: trimmedPara,
                    size: 22,
                  }),
                ],
                spacing: { after: 150 },
              })
            )
          }
        })
      }
      
      // Crear el documento
      const doc = new Document({
        sections: [{
          properties: {
            page: {
              margin: {
                top: 1440,    // 1 pulgada (en twips)
                right: 1440,
                bottom: 1440,
                left: 1440,
              },
            },
          },
          children: children,
        }],
      })
      
      // Generar y descargar el DOCX
      const blob = await Packer.toBlob(doc)
      const fileName = `examen_adaptado_${materia.replace(/\s+/g, '_') || 'examen'}_${new Date().toISOString().split('T')[0]}.docx`
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
          <label className="block text-sm text-gray-600 mb-1">Contenidos del examen *</label>
          <Textarea 
            value={contenidos} 
            onChange={e => setContenidos(e.target.value)} 
            placeholder="Describe los contenidos que debe cubrir el examen (temas, unidades, competencias...)"
            rows={3}
            className="w-full"
          />
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
                {docxFile && (
                  <span className="text-sm text-green-600">✓ {docxFile.name}</span>
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
