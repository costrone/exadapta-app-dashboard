import { onRequest } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import * as logger from 'firebase-functions/logger'
import fetch from 'node-fetch'
import corsLib from 'cors'

const cors = corsLib({ origin: true })
const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY')

export const generate = onRequest({ region: 'europe-west1', secrets: [GEMINI_API_KEY], timeoutSeconds: 120, memory: '512MiB' }, async (req, res): Promise<void> => {
  await new Promise<void>(resolve => cors(req as any, res as any, () => resolve()))
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' }); return
  }
  try {
    const apiKey = GEMINI_API_KEY.value()
    if (!apiKey) {
      res.status(500).json({ error: 'Missing GEMINI_API_KEY' }); return
    }
    const { subject, course, numQuestions, promptOverride, returnText } = req.body || {}
    if (!subject || !course || !numQuestions) {
      res.status(400).json({ error: 'Missing subject/course/numQuestions' }); return
    }
    const prompt = promptOverride ||
      `Eres un generador de ítems para docentes en la Región de Murcia (España). Genera ${numQuestions} preguntas tipo test en español sobre ${subject} para el curso/nivel "${course}", teniendo en cuenta el currículo oficial vigente de la Región de Murcia y las últimas leyes educativas de España y de la propia Región de Murcia. Ajusta la dificultad, vocabulario y profundidad al nivel del curso y asegúrate de cubrir resultados de aprendizaje y contenidos curriculares relevantes. Cada pregunta debe tener 4 opciones (A-D), indica la correcta en correctKey y asigna un nivel 1-5 equilibrado (1 más fácil, 5 más difícil). Devuelve SOLO JSON válido con esta forma exacta: {"items":[{ "stem":"...", "options":[{"key":"A","text":"..."},{"key":"B","text":"..."},{"key":"C","text":"..."},{"key":"D","text":"..."}], "correctKey":"A|B|C|D", "level":1-5 }...]}`
    
    // Detectar si el prompt pide JSON o texto
    const expectsJSON = returnText === false || (promptOverride && /devuelve.*json|json.*válido|formato.*json/i.test(prompt))
    const expectsText = returnText === true || (promptOverride && !expectsJSON && /formato.*texto|texto.*estructurado/i.test(prompt))

    // Helper: fetch con timeout (aumentado para solicitudes grandes)
    const fetchWithTimeout = async (url: string, init: any, ms = 90000) => {
      const ac = new AbortController()
      const t = setTimeout(() => ac.abort(), ms)
      try {
        // @ts-ignore
        const r = await fetch(url, { ...init, signal: ac.signal })
        return r
      } finally { clearTimeout(t) }
    }

    // Descubre modelos disponibles en este proyecto/clave y elige uno compatible (con reintento)
    const t0 = Date.now()
    let listRes = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, { method: 'GET' })
    if (!listRes.ok) {
      listRes = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, { method: 'GET' })
    }
    if (!listRes.ok) {
      const txt = await listRes.text().catch(()=> '')
      res.status(400).json({ error: 'ListModels failed', details: txt }); return
    }
    const listJson: any = await listRes.json()
    const models: any[] = Array.isArray(listJson?.models) ? listJson.models : []
    const compatible = models.filter(m => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
    // preferir flash, luego pro, si no el primero
    const pick = (arr: any[], token: string) => arr.find(m => String(m.name || '').includes(token))
    const chosen = pick(compatible, 'flash') || pick(compatible, 'pro') || compatible[0]
    if (!chosen?.name) {
      res.status(400).json({ error: 'No compatible model found', details: models.map(m=>m?.name).filter(Boolean) }); return
    }
    // Normaliza nombre: la API acepta "{model}" o "models/{model}"; evitamos duplicar "models/"
    const rawName = String(chosen.name || '')
    const modelId = rawName.startsWith('models/') ? rawName.slice('models/'.length) : rawName
    const endpointBase = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent?key=${apiKey}`
    logger.info('Gemini model chosen', { model: modelId })

    const errors: string[] = []
    let data: any = null
    {
      // Llamada con hasta 2 intentos
      for (let attempt = 1; attempt <= 2; attempt++) {
        const r = await fetchWithTimeout(endpointBase, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }]}] })
        })
        if (r.ok) { data = await r.json(); break }
        try { const j: any = await r.json(); errors.push(`${r.status}${j && j.error && j.error.message ? `: ${j.error.message}` : ''}`) } catch { errors.push(String(r.status)) }
      }
    }
    if (!data) {
      logger.error('Gemini error', errors)
      res.status(400).json({ error: 'Gemini error', details: errors }); return
    }
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
    
    // Si se espera texto, devolverlo directamente
    if (expectsText) {
      const t1 = Date.now()
      logger.info('Gemini generate OK (text)', { ms: t1 - t0, textLength: text.length })
      res.json({ text, candidates: data?.candidates })
      return
    }
    
    // Si se espera JSON, intentar parsearlo
    let parsed: any
    try { 
      parsed = JSON.parse(text) 
    } catch {
      // Intentar extraer JSON del texto si está embebido
      const match = text.match(/\{[\s\S]*\}/)
      if (!match) { 
        // Si no hay JSON y no se espera texto, es un error
        logger.error('No JSON found in response', { text: text.substring(0, 200) })
        res.status(400).json({ error: 'Invalid JSON from model', details: 'La respuesta no contiene JSON válido' }); 
        return 
      }
      parsed = JSON.parse(match[0])
    }
    const t1 = Date.now()
    logger.info('Gemini generate OK', { ms: t1 - t0, items: Array.isArray(parsed.items) ? parsed.items.length : 0 })
    res.json({ items: parsed.items || [] })
  } catch (e: any) {
    logger.error('Error in generate function', { error: e?.message || String(e), stack: e?.stack })
    const errorMessage = e?.message || String(e) || 'Unknown error'
    // Si es un error de timeout o abort, indicarlo específicamente
    if (errorMessage.includes('abort') || errorMessage.includes('timeout') || e?.name === 'AbortError') {
      res.status(504).json({ error: 'Request timeout', details: 'La solicitud tardó demasiado. Intenta con menos preguntas.' })
    } else if (errorMessage.includes('fetch') || errorMessage.includes('network')) {
      res.status(503).json({ error: 'Network error', details: 'Error de conexión con el servicio de IA. Intenta de nuevo.' })
    } else {
      res.status(502).json({ error: 'Upstream error', details: errorMessage })
    }
  }
})


