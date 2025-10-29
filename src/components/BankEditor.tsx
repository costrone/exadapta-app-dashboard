import { useEffect, useState } from 'react'
import { addDoc, collection, doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'

type Policy = {
  minItems: number
  maxItems: number
  stabilizationDelta: number
  stabilizationWindow: number
  startLevel: 1|2|3|4|5
}

export function BankEditor({ bankId, onCreated, onUpdated } : { bankId?: string; onCreated?: (id:string)=>void; onUpdated?: ()=>void }) {
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [policy, setPolicy] = useState<Policy>({ minItems: 8, maxItems: 18, stabilizationDelta: 0.25, stabilizationWindow: 3, startLevel: 3 })

  useEffect(() => {
    if (!bankId) return
    ;(async () => {
      const snap = await getDoc(doc(db, 'banks', bankId))
      if (snap.exists()) {
        const data = snap.data() as any
        setName(data.name || '')
        setSubject(data.subject || '')
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
    const ref = await addDoc(collection(db, 'banks'), { name, subject, scale: { min: 1, max: 5 }, policy })
    onCreated?.(ref.id)
    setName('')
    setSubject('')
  }

  async function updateBank() {
    if (!bankId) return
    await setDoc(doc(db, 'banks', bankId), { name, subject, scale: { min:1, max:5 }, policy }, { merge: true })
    onUpdated?.()
  }

  const canSave = name.trim().length > 0 && subject.trim().length > 0

  return (
    <div className="rounded-xl border p-4">
      <h3 className="font-semibold">{bankId ? 'Editar banco' : 'Nuevo banco'}</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-sm text-gray-600 mb-1">Nombre</label>
          <input value={name} onChange={e=>setName(e.target.value)} className="w-full border rounded-lg px-3 py-2" placeholder="Banco Física 1º Bach" />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Asignatura</label>
          <input value={subject} onChange={e=>setSubject(e.target.value)} className="w-full border rounded-lg px-3 py-2" placeholder="physics" />
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-5">
        <div>
          <label className="block text-sm text-gray-600 mb-1">Mín. ítems</label>
          <input type="number" value={policy.minItems} onChange={e=>setPolicy(p=>({...p, minItems: Number(e.target.value)}))} className="w-full border rounded-lg px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Máx. ítems</label>
          <input type="number" value={policy.maxItems} onChange={e=>setPolicy(p=>({...p, maxItems: Number(e.target.value)}))} className="w-full border rounded-lg px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Delta estabilización</label>
          <input type="number" step="0.01" value={policy.stabilizationDelta} onChange={e=>setPolicy(p=>({...p, stabilizationDelta: Number(e.target.value)}))} className="w-full border rounded-lg px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Ventana estabilización</label>
          <input type="number" value={policy.stabilizationWindow} onChange={e=>setPolicy(p=>({...p, stabilizationWindow: Number(e.target.value)}))} className="w-full border rounded-lg px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Nivel inicial</label>
          <select value={policy.startLevel} onChange={e=>setPolicy(p=>({...p, startLevel: Number(e.target.value) as 1|2|3|4|5}))} className="w-full border rounded-lg px-3 py-2">
            {[1,2,3,4,5].map(n=> <option key={n} value={n}>L{n}</option>)}
          </select>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        {bankId ? (
          <button disabled={!canSave} onClick={updateBank} className={"px-4 py-2 rounded-xl border "+(canSave?"bg-blue-600 text-white border-blue-600 hover:bg-blue-700":"opacity-50 cursor-not-allowed")}>Guardar cambios</button>
        ) : (
          <button disabled={!canSave} onClick={createBank} className={"px-4 py-2 rounded-xl border "+(canSave?"bg-blue-600 text-white border-blue-600 hover:bg-blue-700":"opacity-50 cursor-not-allowed")}>Crear banco</button>
        )}
      </div>
    </div>
  )
}


