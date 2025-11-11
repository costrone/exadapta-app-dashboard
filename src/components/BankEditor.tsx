import { useEffect, useState } from 'react'
import { addDoc, collection, doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { Button } from '../ui/Button'
import { useToast } from '../ui/toast'

type Policy = {
  minItems: number
  maxItems: number
  stabilizationDelta: number
  stabilizationWindow: number
  startLevel: 1|2|3|4|5
  semTarget?: number // Error Estándar objetivo (opcional)
}

export function BankEditor({ bankId, onCreated, onUpdated } : { bankId?: string; onCreated?: (id:string)=>void; onUpdated?: ()=>void }) {
  const { show } = useToast()
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [course, setCourse] = useState('')
  const [policy, setPolicy] = useState<Policy>({ minItems: 12, maxItems: 30, stabilizationDelta: 0.20, stabilizationWindow: 5, startLevel: 3, semTarget: 0.30 })

  useEffect(() => {
    if (!bankId) return
    ;(async () => {
      const snap = await getDoc(doc(db, 'banks', bankId))
      if (snap.exists()) {
        const data = snap.data() as any
        setName(data.name || '')
        setSubject(data.subject || '')
        setCourse(data.course || '')
        setPolicy({
          minItems: data.policy?.minItems ?? 12,
          maxItems: data.policy?.maxItems ?? 30,
          stabilizationDelta: data.policy?.stabilizationDelta ?? 0.20,
          stabilizationWindow: data.policy?.stabilizationWindow ?? 5,
          startLevel: (data.policy?.startLevel ?? 3) as 1|2|3|4|5,
          semTarget: data.policy?.semTarget ?? 0.30,
        })
      }
    })()
  }, [bankId])

  async function createBank() {
    const ref = await addDoc(collection(db, 'banks'), { name, subject, course, scale: { min: 1, max: 5 }, policy })
    onCreated?.(ref.id)
    setName('')
    setSubject('')
    setCourse('')
    show('Banco creado', 'success')
  }

  async function updateBank() {
    if (!bankId) return
    await setDoc(doc(db, 'banks', bankId), { name, subject, course, scale: { min:1, max:5 }, policy }, { merge: true })
    onUpdated?.()
    show('Cambios guardados', 'success')
  }

  const canSave = name.trim().length > 0 && subject.trim().length > 0 && course.trim().length > 0

  return (
    <div className="rounded-xl border p-4">
      <h3 className="font-semibold">{bankId ? 'Editar banco' : 'Nuevo banco'}</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div>
          <label className="block text-sm text-gray-600 mb-1">Nombre</label>
          <Input value={name} onChange={e=>setName((e.target as HTMLInputElement).value)} placeholder="Banco Física 1º Bach" />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Asignatura</label>
          <Input value={subject} onChange={e=>setSubject((e.target as HTMLInputElement).value)} placeholder="physics" />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Curso/Nivel</label>
          <Input value={course} onChange={e=>setCourse((e.target as HTMLInputElement).value)} placeholder="1º ESO, 2º Bach, etc." />
        </div>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="flex flex-col space-y-1">
          <label className="block text-sm text-gray-600">Mín. ítems</label>
          <Input type="number" value={policy.minItems} onChange={e=>setPolicy(p=>({...p, minItems: Number((e.target as HTMLInputElement).value)}))} />
          <span className="text-xs text-gray-500 mt-1">Recomendado: 10-15</span>
        </div>
        <div className="flex flex-col space-y-1">
          <label className="block text-sm text-gray-600">Máx. ítems</label>
          <Input type="number" value={policy.maxItems} onChange={e=>setPolicy(p=>({...p, maxItems: Number((e.target as HTMLInputElement).value)}))} />
          <span className="text-xs text-gray-500 mt-1">Recomendado: 25-40</span>
        </div>
        <div className="flex flex-col space-y-1">
          <label className="block text-sm text-gray-600">Delta estabilización</label>
          <Input type="number" step="0.01" value={policy.stabilizationDelta} onChange={e=>setPolicy(p=>({...p, stabilizationDelta: Number((e.target as HTMLInputElement).value)}))} />
          <span className="text-xs text-gray-500 mt-1">Recomendado: 0.20-0.25</span>
        </div>
        <div className="flex flex-col space-y-1">
          <label className="block text-sm text-gray-600">Ventana estabilización</label>
          <Input type="number" value={policy.stabilizationWindow} onChange={e=>setPolicy(p=>({...p, stabilizationWindow: Number((e.target as HTMLInputElement).value)}))} />
          <span className="text-xs text-gray-500 mt-1">Recomendado: 5-8</span>
        </div>
        <div className="flex flex-col space-y-1">
          <label className="block text-sm text-gray-600">SEM objetivo</label>
          <Input type="number" step="0.01" value={policy.semTarget ?? ''} onChange={e=>setPolicy(p=>({...p, semTarget: e.target.value ? Number((e.target as HTMLInputElement).value) : undefined}))} placeholder="0.30" />
          <span className="text-xs text-gray-500 mt-1">Recomendado: 0.30</span>
        </div>
        <div className="flex flex-col space-y-1">
          <label className="block text-sm text-gray-600">Nivel inicial</label>
          <Select value={policy.startLevel} onChange={e=>setPolicy(p=>({...p, startLevel: Number((e.target as HTMLSelectElement).value) as 1|2|3|4|5}))}>
            {[1,2,3,4,5].map(n=> <option key={n} value={n}>L{n}</option>)}
          </Select>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        {bankId ? (
          <Button disabled={!canSave} onClick={updateBank} variant={canSave? 'primary':'ghost'}>Guardar cambios</Button>
        ) : (
          <Button disabled={!canSave} onClick={createBank} variant={canSave? 'primary':'ghost'}>Crear banco</Button>
        )}
      </div>
    </div>
  )
}


