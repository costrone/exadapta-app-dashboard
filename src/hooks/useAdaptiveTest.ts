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
}

export function useAdaptiveTest(allItems: Item[], policy: Policy) {
  const [history, setHistory] = useState<{itemId:string; levelShown:number; answerKey?:string; correct?:boolean; levelAfter:number;}[]>([])
  const [current, setCurrent] = useState<Item | null>(null)
  const [level, setLevel] = useState<number>(policy.startLevel)
  const [finished, setFinished] = useState(false)
  const estimateRef = useRef<number>(policy.startLevel)

  const remaining = useMemo(() => allItems.filter(i => !history.some(h => h.itemId===i.id)), [allItems, history])

  const pickNext = (lvl:number) => {
    const pool = remaining.filter(i => i.level === lvl)
    if (pool.length === 0) {
      const byDist = [...remaining].sort((a,b)=> Math.abs(a.level-lvl)-Math.abs(b.level-lvl))
      return byDist[0] ?? null
    }
    return pool[Math.floor(Math.random()*pool.length)]
  }

  const start = () => {
    const nxt = pickNext(level)
    setCurrent(nxt)
  }

  const answer = (answerKey:string) => {
    if (!current) return
    const correct = answerKey === current.correctKey
    const newLevel = correct ? Math.min(level+1, 5) : Math.max(level-1, 1)

    const alpha = 0.6
    estimateRef.current = alpha*current.level + (1-alpha)*estimateRef.current

    const rec = { itemId: current.id, levelShown: level, answerKey, correct, levelAfter: newLevel }
    setHistory(h => [...h, rec])
    setLevel(newLevel)

    const n = history.length + 1
    const window =  policy.stabilizationWindow
    let stabilized = false
    if (n >= Math.max(policy.minItems, window)) {
      const recent = [...history, rec].slice(-window).map(r => r.levelAfter)
      const delta = Math.max(...recent) - Math.min(...recent)
      stabilized = delta <= policy.stabilizationDelta
    }
    if (n >= policy.maxItems || (n >= policy.minItems && stabilized)) {
      setFinished(true)
      setCurrent(null)
      return
    }

    const nxt = pickNext(newLevel)
    setCurrent(nxt)
  }

  const reset = () => {
    setHistory([])
    setCurrent(null)
    setLevel(policy.startLevel)
    setFinished(false)
    estimateRef.current = policy.startLevel
  }

  return { current, level, history, estimate: estimateRef.current, finished, start, answer, reset }
}
