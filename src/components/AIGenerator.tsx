import { useState } from 'react'
import { addDoc, collection } from 'firebase/firestore'
import { db } from '../lib/firebase'

type GeneratedItem = {
  stem: string
  options: { key: string; text: string }[]
  correctKey: string
  level: 1|2|3|4|5
}

export function AIGenerator({ onCreated } : { onCreated: (bankId:string)=>void }) {
  const [subject, setSubject] = useState('')
  const [name, setName] = useState('Banco IA')
  const [course, setCourse] = useState('')
  const [numQuestions, setNumQuestions] = useState(20)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')

  const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined
  const canUseAI = Boolean(apiKey)
  const canGenerate = canUseAI && subject.trim().length > 0 && course.trim().length > 0 && numQuestions > 0 && !loading

  async function generateWithAI(): Promise<GeneratedItem[]> {
    const prompt = `Eres un generador de ítems para docentes en la Región de Murcia (España). Genera ${numQuestions} preguntas tipo test en español sobre ${subject} para el curso/nivel "${course}", teniendo en cuenta el currículo oficial vigente de la Región de Murcia y las últimas leyes educativas de España y de la propia Región de Murcia. Ajusta la dificultad, vocabulario y profundidad al nivel del curso y asegúrate de cubrir resultados de aprendizaje y contenidos curriculares relevantes. Cada pregunta debe tener 4 opciones (A-D), indica la correcta en correctKey y asigna un nivel 1-5 equilibrado (1 más fácil, 5 más difícil). Devuelve SOLO JSON válido con esta forma exacta: {"items":[{ "stem":"...", "options":[{"key":"A","text":"..."},{"key":"B","text":"..."},{"key":"C","text":"..."},{"key":"D","text":"..."}], "correctKey":"A|B|C|D", "level":1-5 }...]}`
    // Algunos proyectos sólo soportan v1beta o el alias -latest no está disponible
    const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + apiKey
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }]}]
      })
    })
    if (!res.ok) {
      let msg = `API IA error ${res.status}`
      try { const j = await res.json(); if (j?.error?.message) msg = msg+`: ${j.error.message}` } catch {}
      throw new Error(msg)
    }
    const data = await res.json()
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
    let parsed: any
    try {
      parsed = JSON.parse(text)
    } catch {
      const match = text.match(/\{[\s\S]*\}/)
      if (!match) throw new Error('No se pudo parsear la respuesta de IA')
      parsed = JSON.parse(match[0])
    }
    const items = (parsed.items || []) as GeneratedItem[]
    if (!Array.isArray(items) || items.length === 0) throw new Error('La IA no devolvió ítems')
    return items
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
        policy: { minItems: 8, maxItems: 18, stabilizationDelta: 0.25, stabilizationWindow: 3, startLevel: 3 }
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
    } catch (e:any) {
      setError(e?.message || 'Error generando banco')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl border p-4 space-y-3">
      <h3 className="font-semibold">Generar banco con IA</h3>
      {!canUseAI && (
        <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
          Define VITE_GEMINI_API_KEY en tu entorno para usar esta función.
        </div>
      )}
      <div className="grid sm:grid-cols-4 gap-3">
        <div>
          <label className="block text-sm text-gray-600 mb-1">Asignatura/tema</label>
          <input value={subject} onChange={e=>setSubject(e.target.value)} className="w-full border rounded-lg px-3 py-2" placeholder="p. ej., historia de España" />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Nombre del banco</label>
          <input value={name} onChange={e=>setName(e.target.value)} className="w-full border rounded-lg px-3 py-2" placeholder="Banco IA" />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Curso/Nivel</label>
          <input value={course} onChange={e=>setCourse(e.target.value)} className="w-full border rounded-lg px-3 py-2" placeholder="1º ESO, 2º Bach, etc." />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Número de preguntas</label>
          <input type="number" min={4} max={100} value={numQuestions} onChange={e=>setNumQuestions(Number(e.target.value))} className="w-full border rounded-lg px-3 py-2" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button disabled={!canGenerate} onClick={handleGenerate} className={"px-4 py-2 rounded-xl border "+(canGenerate?"bg-blue-600 text-white border-blue-600 hover:bg-blue-700":"opacity-50 cursor-not-allowed")}>{loading? 'Generando…' : 'Generar banco'}</button>
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </div>
  )
}


