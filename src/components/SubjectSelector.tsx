import { useEffect, useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../lib/firebase'

export function SubjectSelector({ value, onChange } : { value: string; onChange: (subject:string)=>void }) {
  const [subjects, setSubjects] = useState<string[]>([])

  useEffect(() => {
    (async () => {
      const snap = await getDocs(collection(db, 'banks'))
      const all = new Set<string>()
      snap.docs.forEach(d => {
        const s = (d.data() as any).subject
        if (typeof s === 'string' && s.trim()) all.add(s)
      })
      setSubjects(Array.from(all).sort((a,b)=> a.localeCompare(b)))
    })()
  }, [])

  return (
    <div className="flex items-center gap-2">
      <label className="text-sm text-gray-600">Asignatura:</label>
      <select value={value} onChange={e=>onChange(e.target.value)} className="border rounded-lg px-3 py-2">
        <option value="">— Selecciona asignatura —</option>
        {subjects.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
    </div>
  )
}


