import { onRequest } from 'firebase-functions/v2/https'
import * as logger from 'firebase-functions/logger'
import fetch from 'node-fetch'
import corsLib from 'cors'

const cors = corsLib({ origin: true })

export const generate = onRequest({ region: 'europe-west1' }, async (req, res): Promise<void> => {
  await new Promise<void>(resolve => cors(req as any, res as any, () => resolve()))
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' }); return
  }
  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      res.status(500).json({ error: 'Missing GEMINI_API_KEY' }); return
    }
    const { subject, course, numQuestions, promptOverride } = req.body || {}
    if (!subject || !course || !numQuestions) {
      res.status(400).json({ error: 'Missing subject/course/numQuestions' }); return
    }
    const prompt = promptOverride ||
      `Eres un generador de ítems para docentes en la Región de Murcia (España). Genera ${numQuestions} preguntas tipo test en español sobre ${subject} para el curso/nivel "${course}", teniendo en cuenta el currículo oficial vigente de la Región de Murcia y las últimas leyes educativas de España y de la propia Región de Murcia. Ajusta la dificultad, vocabulario y profundidad al nivel del curso y asegúrate de cubrir resultados de aprendizaje y contenidos curriculares relevantes. Cada pregunta debe tener 4 opciones (A-D), indica la correcta en correctKey y asigna un nivel 1-5 equilibrado (1 más fácil, 5 más difícil). Devuelve SOLO JSON válido con esta forma exacta: {"items":[{ "stem":"...", "options":[{"key":"A","text":"..."},{"key":"B","text":"..."},{"key":"C","text":"..."},{"key":"D","text":"..."}], "correctKey":"A|B|C|D", "level":1-5 }...]}`

    const candidates = [
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=',
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-8b:generateContent?key=',
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.0-pro:generateContent?key='
    ]

    const errors: string[] = []
    let data: any = null
    for (const base of candidates) {
      const url = base + apiKey
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }]}] })
      })
      if (r.ok) { data = await r.json(); break }
      try { const j: any = await r.json(); errors.push(`${r.status}${j && j.error && j.error.message ? `: ${j.error.message}` : ''}`) } catch { errors.push(String(r.status)) }
    }
    if (!data) {
      logger.error('Gemini error', errors)
      res.status(400).json({ error: 'Gemini error', details: errors }); return
    }
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
    let parsed: any
    try { parsed = JSON.parse(text) }
    catch {
      const match = text.match(/\{[\s\S]*\}/)
      if (!match) { res.status(400).json({ error: 'Invalid JSON from model' }); return }
      parsed = JSON.parse(match[0])
    }
    res.json({ items: parsed.items || [] })
  } catch (e: any) {
    logger.error(e)
    res.status(500).json({ error: 'Internal error' })
  }
})


