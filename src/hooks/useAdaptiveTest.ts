import { useMemo, useRef, useState } from 'react'

export type Item = {
  id: string
  stem: string
  options: { key: string; text: string }[]
  correctKey: string
  level: 1|2|3|4|5
}

type Policy = {
  minItems: number
  maxItems: number
  stabilizationDelta: number
  stabilizationWindow: number
  startLevel: 1|2|3|4|5
  semTarget?: number // Error Estándar objetivo (opcional)
}

// Utilidades para Teoría de Respuesta al Ítem (TRI)

/**
 * Convierte nivel discreto (1-5) a dificultad en escala logit (theta)
 * Nivel 1 = -2.0 (muy fácil), Nivel 3 = 0.0 (medio), Nivel 5 = +2.0 (muy difícil)
 */
function levelToDifficulty(level: number): number {
  return (level - 3) * 1.0 // Escala: -2.0 a +2.0
}

/**
 * Convierte theta (habilidad estimada) a nivel discreto para visualización
 */
function thetaToLevel(theta: number): number {
  const level = Math.round(theta / 1.0 + 3)
  return Math.max(1, Math.min(5, level))
}

/**
 * Función logística (modelo 2PL simplificado)
 * P(correcta | theta, b, a) = 1 / (1 + exp(-a * (theta - b)))
 * 
 * @param theta Habilidad del alumno
 * @param b Dificultad del ítem
 * @param a Discriminación del ítem (por defecto 1.0, simplificado)
 */
function probabilityCorrect(theta: number, b: number, a: number = 1.0): number {
  return 1 / (1 + Math.exp(-a * (theta - b)))
}

/**
 * Información del ítem (Fisher Information) para modelo 2PL
 * I(theta) = a² * P(theta) * Q(theta)
 * donde Q = 1 - P
 */
function itemInformation(theta: number, b: number, a: number = 1.0): number {
  const p = probabilityCorrect(theta, b, a)
  const q = 1 - p
  return a * a * p * q
}

/**
 * Estimación de habilidad usando Máxima Verosimilitud (MLE)
 * Encuentra theta que maximiza la probabilidad de las respuestas observadas
 */
function estimateThetaMLE(
  responses: Array<{ itemId: string; correct: boolean; difficulty: number }>,
  items: Item[]
): number {
  if (responses.length === 0) return 0.0 // Nivel medio inicial

  // Función de log-verosimilitud
  const logLikelihood = (theta: number): number => {
    let ll = 0
    for (const r of responses) {
      const item = items.find(i => i.id === r.itemId)
      if (!item) continue
      const b = levelToDifficulty(r.difficulty)
      const p = probabilityCorrect(theta, b)
      ll += r.correct ? Math.log(p) : Math.log(1 - p)
    }
    return ll
  }

  // Búsqueda por bisección para encontrar theta que maximiza log-likelihood
  let thetaMin = -3.0
  let thetaMax = 3.0
  let bestTheta = 0.0
  let bestLL = logLikelihood(0.0)

  // Búsqueda en pasos de 0.1
  for (let theta = thetaMin; theta <= thetaMax; theta += 0.1) {
    const ll = logLikelihood(theta)
    if (ll > bestLL) {
      bestLL = ll
      bestTheta = theta
    }
  }

  return bestTheta
}

/**
 * Calcula el Error Estándar de Medida (SEM) basado en la información total
 * SEM = 1 / sqrt(sum(I(theta)))
 */
function calculateSEM(
  theta: number,
  responses: Array<{ itemId: string; difficulty: number }>,
  items: Item[]
): number {
  let totalInfo = 0
  for (const r of responses) {
    const item = items.find(i => i.id === r.itemId)
    if (!item) continue
    const b = levelToDifficulty(r.difficulty)
    totalInfo += itemInformation(theta, b)
  }
  return totalInfo > 0 ? 1 / Math.sqrt(totalInfo) : 1.0 // Si no hay información, SEM alto
}

/**
 * Selecciona el ítem con máxima información en el nivel de habilidad estimado
 */
function selectItemByMaxInformation(
  availableItems: Item[],
  theta: number
): Item | null {
  if (availableItems.length === 0) return null

  let bestItem: Item | null = null
  let maxInfo = -Infinity

  for (const item of availableItems) {
    const b = levelToDifficulty(item.level)
    const info = itemInformation(theta, b)
    if (info > maxInfo) {
      maxInfo = info
      bestItem = item
    }
  }

  return bestItem
}

export function useAdaptiveTest(allItems: Item[], policy: Policy) {
  const [history, setHistory] = useState<{
    itemId: string
    levelShown: number
    answerKey?: string
    correct?: boolean
    levelAfter: number
    theta?: number // Habilidad estimada después de esta respuesta
    sem?: number // Error estándar después de esta respuesta
  }[]>([])
  const [current, setCurrent] = useState<Item | null>(null)
  const [level, setLevel] = useState<number>(policy.startLevel)
  const [finished, setFinished] = useState(false)
  const thetaRef = useRef<number>(levelToDifficulty(policy.startLevel)) // Habilidad en escala logit
  const estimateRef = useRef<number>(policy.startLevel) // Nivel discreto para visualización

  const answeredIds = useMemo(() => history.map(h => h.itemId), [history])

  const remaining = useMemo(
    () => allItems.filter(i => !answeredIds.includes(i.id)),
    [allItems, answeredIds]
  )

  const start = () => {
    // Inicializar con nivel de inicio
    thetaRef.current = levelToDifficulty(policy.startLevel)
    estimateRef.current = policy.startLevel
    const nxt = selectItemByMaxInformation(remaining, thetaRef.current)
    setCurrent(nxt)
  }

  const answer = (answerKey: string) => {
    if (!current) return

    const correct = answerKey === current.correctKey
    const difficulty = levelToDifficulty(current.level)

    // Añadir respuesta al historial temporal para estimación
    const tempResponses = [
      ...history.map(h => {
        const item = allItems.find(i => i.id === h.itemId)
        return {
          itemId: h.itemId,
          correct: h.correct ?? false,
          difficulty: item?.level ?? 3
        }
      }),
      {
        itemId: current.id,
        correct,
        difficulty: current.level
      }
    ]

    // Re-estimar habilidad usando MLE
    const newTheta = estimateThetaMLE(tempResponses, allItems)
    thetaRef.current = newTheta
    estimateRef.current = thetaToLevel(newTheta)

    // Calcular SEM actual
    const currentSEM = calculateSEM(newTheta, tempResponses, allItems)

    // Actualizar nivel discreto para selección (redondeado)
    const newLevel = thetaToLevel(newTheta)

    const rec = {
      itemId: current.id,
      levelShown: current.level,
      answerKey,
      correct,
      levelAfter: newLevel,
      theta: newTheta,
      sem: currentSEM
    }

    const newHistory = [...history, rec]
    setHistory(newHistory)
    setLevel(newLevel)

    const n = newHistory.length

    // Criterio 1: Verificar estabilización por delta y ventana
    const window = policy.stabilizationWindow
    let stabilized = false
    if (n >= Math.max(policy.minItems, window)) {
      const recentThetas = newHistory.slice(-window).map(r => r.theta ?? thetaRef.current)
      const delta = Math.max(...recentThetas) - Math.min(...recentThetas)
      stabilized = delta <= policy.stabilizationDelta
    }

    // Criterio 2: Verificar SEM objetivo (si está configurado)
    const semTarget = policy.semTarget ?? null
    const semReached = semTarget !== null && currentSEM <= semTarget

    // Finalizar si:
    // - Se alcanzó el máximo de ítems
    // - Se cumplió el mínimo Y (estabilización O SEM alcanzado)
    if (
      n >= policy.maxItems ||
      (n >= policy.minItems && (stabilized || semReached))
    ) {
      setFinished(true)
      setCurrent(null)
      return
    }

    // Seleccionar siguiente ítem por máxima información
    const alreadyUsed = new Set(newHistory.map(h => h.itemId))
    const remainingAfterAnswer = allItems.filter(i => !alreadyUsed.has(i.id))
    const nxt = selectItemByMaxInformation(remainingAfterAnswer, newTheta)

    if (!nxt) {
      setFinished(true)
      setCurrent(null)
      return
    }

    setCurrent(nxt)
  }

  const reset = () => {
    setHistory([])
    setCurrent(null)
    setLevel(policy.startLevel)
    setFinished(false)
    thetaRef.current = levelToDifficulty(policy.startLevel)
    estimateRef.current = policy.startLevel
  }

  // Calcular SEM actual para visualización
  const currentSEM = useMemo(() => {
    if (history.length === 0) return null
    const responses = history.map(h => {
      const item = allItems.find(i => i.id === h.itemId)
      return {
        itemId: h.itemId,
        difficulty: item?.level ?? 3
      }
    })
    return calculateSEM(thetaRef.current, responses, allItems)
  }, [history, allItems])

  return {
    current,
    level,
    history,
    estimate: estimateRef.current,
    theta: thetaRef.current, // Habilidad en escala logit
    sem: currentSEM, // Error estándar actual
    finished,
    start,
    answer,
    reset
  }
}
