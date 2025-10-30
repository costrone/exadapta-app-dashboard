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
}

export function BankEditor({ bankId, onCreated, onUpdated } : { bankId?: string; onCreated?: (id:string)=>void; onUpdated?: ()=>void }) {
  const { show } = useToast()
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [course, setCourse] = useState('')
  const [policy, setPolicy] = useState<Policy>({ minItems: 8, maxItems: 18, stabilizationDelta: 0.25, stabilizationWindow: 3, startLevel: 3 })

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
          minItems: data.policy?.minItems ?? 8,
          maxItems: data.policy?.maxItems ?? 18,
          stabilizationDelta: data.policy?.stabilizationDelta ?? 0.25,
          stabilizationWindow: data.policy?.stabilizationWindow ?? 3,
          startLevel: (data.policy?.startLevel ?? 3) as 1|2|3|4|5,
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
      <div className="mt-4 grid gap-3 sm:grid-cols-5">
        <div>
          <label className="block text-sm text-gray-600 mb-1">Mín. ítems</label>
          <Input type="number" value={policy.minItems} onChange={e=>setPolicy(p=>({...p, minItems: Number((e.target as HTMLInputElement).value)}))} />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Máx. ítems</label>
          <Input type="number" value={policy.maxItems} onChange={e=>setPolicy(p=>({...p, maxItems: Number((e.target as HTMLInputElement).value)}))} />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Delta estabilización</label>
          <Input type="number" step="0.01" value={policy.stabilizationDelta} onChange={e=>setPolicy(p=>({...p, stabilizationDelta: Number((e.target as HTMLInputElement).value)}))} />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Ventana estabilización</label>
          <Input type="number" value={policy.stabilizationWindow} onChange={e=>setPolicy(p=>({...p, stabilizationWindow: Number((e.target as HTMLInputElement).value)}))} />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Nivel inicial</label>
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


