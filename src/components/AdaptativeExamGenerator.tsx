import { useState } from 'react'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Textarea } from '../ui/Textarea'
import { Select } from '../ui/Select'
import { useToast } from '../ui/toast'
import jsPDF from 'jspdf'

type QuestionType = 'test' | 'desarrollo' | 'mixto'

export function AdaptativeExamGenerator({ onGenerated }: { onGenerated?: (examContent: string) => void }) {
  const { show } = useToast()
  const [materia, setMateria] = useState('')
  const [contenidos, setContenidos] = useState('')
  const [numPreguntas, setNumPreguntas] = useState(10)
  const [tipoPreguntas, setTipoPreguntas] = useState<QuestionType>('test')
  const [necesidades, setNecesidades] = useState('')
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [pdfText, setPdfText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [generatedExam, setGeneratedExam] = useState<string>('')

  const canGenerate = materia.trim().length > 0 && contenidos.trim().length > 0 && numPreguntas > 0 && !loading

  async function extractTextFromPDF(file: File): Promise<string> {
    // Nota: Para extraer texto de PDF en el navegador, necesitaríamos una librería como pdf.js
    // Por ahora, intentamos una importación dinámica y si falla, usamos el nombre del archivo
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = async (e) => {
        try {
          // Intentar importar pdf.js dinámicamente
          try {
            const pdfjsLib = await import('pdfjs-dist')
            pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`
            
            const pdf = await pdfjsLib.getDocument({ data: e.target?.result as ArrayBuffer }).promise
            let text = ''
            
            for (let i = 1; i <= pdf.numPages; i++) {
              const page = await pdf.getPage(i)
              const textContent = await page.getTextContent()
              text += textContent.items.map((item: any) => item.str).join(' ') + '\n'
            }
            
            resolve(text)
          } catch (importError) {
            // Si no está disponible pdf.js, usar el nombre del archivo
            show('La extracción de texto del PDF requiere pdf.js. Por ahora se usará el nombre del archivo como referencia. El examen se generará basándose en los otros campos proporcionados.', 'info')
            resolve(`[Archivo PDF cargado: ${file.name}. El profesor debe describir el contenido en el campo "Contenidos del examen" para una mejor adaptación.]`)
          }
        } catch (err) {
          show('Error al procesar el PDF. Se usará el nombre del archivo como referencia.', 'info')
          resolve(`[Archivo PDF: ${file.name}]`)
        }
      }
      reader.onerror = () => {
        show('Error al leer el archivo PDF', 'error')
        reject(new Error('Error al leer el archivo'))
      }
      reader.readAsArrayBuffer(file)
    })
  }

  async function handlePdfUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    
    if (file.type !== 'application/pdf') {
      show('Por favor, selecciona un archivo PDF', 'error')
      return
    }
    
    setPdfFile(file)
    setLoading(true)
    try {
      const text = await extractTextFromPDF(file)
      setPdfText(text)
      show('PDF cargado correctamente', 'success')
    } catch (err: any) {
      show('Error al procesar el PDF: ' + (err?.message || 'Error desconocido'), 'error')
      setPdfFile(null)
    } finally {
      setLoading(false)
    }
  }

  async function generateExam() {
    setLoading(true)
    setError('')
    setGeneratedExam('')
    
    try {
      // Construir el prompt según los datos proporcionados
      let prompt = `Eres un generador de exámenes para docentes de la ESO en la Región de Murcia (España). 
      
Materia: ${materia}
Contenidos del examen: ${contenidos}
Número de preguntas: ${numPreguntas}
Tipo de preguntas: ${tipoPreguntas === 'test' ? 'Preguntas tipo test con 4 opciones (A-D)' : tipoPreguntas === 'desarrollo' ? 'Preguntas de desarrollo' : 'Preguntas mixtas (test y desarrollo)'}
Necesidades del alumno: ${necesidades || 'No se especificaron necesidades especiales'}

${pdfText ? `\nIMPORTANTE: El profesor ha proporcionado un examen en PDF. Debes adaptar el siguiente contenido del PDF teniendo en cuenta las necesidades del alumno:\n\n${pdfText}\n\n` : ''}

Genera un examen completo adaptado a las necesidades del alumno, teniendo en cuenta:
- El currículo oficial vigente de la Región de Murcia
- Las últimas leyes educativas de España y de la Región de Murcia
- Las necesidades específicas del alumno mencionadas
- El nivel educativo de la ESO
- Ajusta la dificultad, vocabulario y profundidad según las necesidades

${tipoPreguntas === 'test' ? 'Devuelve SOLO JSON válido con esta forma exacta: {"items":[{"stem":"...", "options":[{"key":"A","text":"..."},{"key":"B","text":"..."},{"key":"C","text":"..."},{"key":"D","text":"..."}], "correctKey":"A|B|C|D"}]}' : 'Devuelve el examen en formato texto estructurado con las preguntas y, si aplica, las respuestas esperadas.'}`

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

  function downloadExam() {
    if (!generatedExam) return
    
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    })
    
    // Configurar fuente y tamaño
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const margin = 20
    const maxWidth = pageWidth - (margin * 2)
    let yPosition = margin
    
    // Título del examen
    pdf.setFontSize(16)
    pdf.setFont('helvetica', 'bold')
    const title = `Examen Adaptado - ${materia || 'Sin materia'}`
    pdf.text(title, margin, yPosition)
    yPosition += 10
    
    // Fecha
    pdf.setFontSize(10)
    pdf.setFont('helvetica', 'normal')
    const fecha = new Date().toLocaleDateString('es-ES', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })
    pdf.text(`Fecha: ${fecha}`, margin, yPosition)
    yPosition += 8
    
    // Línea separadora
    pdf.setDrawColor(200, 200, 200)
    pdf.line(margin, yPosition, pageWidth - margin, yPosition)
    yPosition += 10
    
    // Contenido del examen
    pdf.setFontSize(11)
    pdf.setFont('helvetica', 'normal')
    
    // Dividir el texto en líneas que quepan en el ancho de la página
    const lines = pdf.splitTextToSize(generatedExam, maxWidth)
    
    // Agregar líneas al PDF, manejando saltos de página
    for (let i = 0; i < lines.length; i++) {
      // Verificar si necesitamos una nueva página
      if (yPosition > pageHeight - margin - 10) {
        pdf.addPage()
        yPosition = margin
      }
      
      pdf.text(lines[i], margin, yPosition)
      yPosition += 6 // Espaciado entre líneas
    }
    
    // Guardar el PDF
    const fileName = `examen_adaptado_${materia || 'examen'}_${new Date().toISOString().split('T')[0]}.pdf`
    pdf.save(fileName)
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
          <label className="block text-sm text-gray-600 mb-1">Cargar examen en PDF (opcional)</label>
          <div className="flex items-center gap-2">
            <input 
              type="file" 
              accept=".pdf" 
              onChange={handlePdfUpload}
              className="text-sm"
              disabled={loading}
            />
            {pdfFile && (
              <span className="text-sm text-green-600">✓ {pdfFile.name}</span>
            )}
          </div>
          {pdfText && (
            <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-600 max-h-32 overflow-auto">
              <strong>Texto extraído del PDF:</strong> {pdfText.substring(0, 200)}...
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
            <Button onClick={downloadExam} variant="outline" size="sm">
              Descargar PDF
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

