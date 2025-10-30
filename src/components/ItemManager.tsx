import { useEffect, useMemo, useState } from 'react'
import { addDoc, collection, deleteDoc, doc, getDocs, query, updateDoc, where } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { Input } from '../ui/Input'
import { Textarea } from '../ui/Textarea'
import { Select } from '../ui/Select'
import { Button } from '../ui/Button'
import { useToast } from '../ui/toast'

type Option = { key: string; text: string }

export function ItemManager({ bankId } : { bankId: string }) {
  const { show } = useToast()
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const [stem, setStem] = useState('')
  const [options, setOptions] = useState<Option[]>([
    { key: 'A', text: '' },
    { key: 'B', text: '' },
    { key: 'C', text: '' },
    { key: 'D', text: '' },
  ])
  const [correctKey, setCorrectKey] = useState('A')
  const [level, setLevel] = useState(3)
  const canCreate = stem.trim().length > 0 && options.every(o => o.text.trim().length > 0)

  async function loadItems() {
    if (!bankId) return
    setLoading(true)
    const snap = await getDocs(query(collection(db, 'items'), where('bankId','==', bankId)))
    setItems(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })))
    setLoading(false)
  }

  useEffect(() => { loadItems() }, [bankId])

  async function createItem() {
    await addDoc(collection(db, 'items'), { bankId, stem, options, correctKey, level, tags: [] })
    setStem('')
    setOptions(options.map(o => ({ ...o, text: '' })))
    setCorrectKey('A')
    setLevel(3)
    await loadItems()
    show('Pregunta creada', 'success')
  }

  async function saveItem(it:any) {
    await updateDoc(doc(db, 'items', it.id), { stem: it.stem, options: it.options, correctKey: it.correctKey, level: it.level })
    await loadItems()
    show('Pregunta guardada', 'success')
  }

  async function removeItem(id:string) {
    if (!confirm('¿Eliminar esta pregunta?')) return
    await deleteDoc(doc(db, 'items', id))
    await loadItems()
    show('Pregunta eliminada', 'info')
  }

  const grouped = useMemo(() => {
    const g: Record<number, any[]> = { 1:[],2:[],3:[],4:[],5:[] }
    for (const it of items) g[it.level]?.push(it)
    return g
  }, [items])

  return (
    <div className="space-y-6">
      <div className="rounded-xl border p-4">
        <h3 className="font-semibold">Añadir nueva pregunta</h3>
        <div className="mt-3 grid gap-3">
          <Textarea value={stem} onChange={e=>setStem(e.target.value)} rows={3} placeholder="Enunciado de la pregunta" />
          <div className="grid sm:grid-cols-2 gap-3">
            {options.map((o, idx) => (
              <div key={o.key} className="flex items-center gap-2">
                <span className="font-mono text-sm w-6">{o.key}.</span>
                <Input value={o.text} onChange={e=>setOptions(prev=> prev.map((p,i)=> i===idx?{...p, text: (e.target as HTMLInputElement).value}:p))} placeholder={`Opción ${o.key}`} />
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm text-gray-600">Correcta:</label>
            <Select value={correctKey} onChange={e=>setCorrectKey((e.target as HTMLSelectElement).value)}>
              {options.map(o => <option key={o.key} value={o.key}>{o.key}</option>)}
            </Select>
            <label className="text-sm text-gray-600 ml-2">Nivel:</label>
            <Select value={level} onChange={e=>setLevel(Number((e.target as HTMLSelectElement).value))}>
              {[1,2,3,4,5].map(n=> <option key={n} value={n}>L{n}</option>)}
            </Select>
            <Button disabled={!canCreate} onClick={createItem} className="ml-auto" variant={canCreate? 'primary':'ghost'}>Guardar pregunta</Button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Preguntas del banco</h3>
          {loading && <span className="text-sm text-gray-600">Cargando…</span>}
        </div>
        <div className="mt-3 space-y-6">
          {[1,2,3,4,5].map(lvl => (
            <div key={lvl}>
              <div className="text-sm font-medium text-gray-700 mb-2">Nivel L{lvl}</div>
              {!grouped[lvl]?.length ? (
                <div className="text-sm text-gray-500">No hay preguntas en este nivel.</div>
              ) : (
                <div className="space-y-3">
                  {grouped[lvl].map(it => (
                    <EditableItem key={it.id} item={it} onSave={saveItem} onDelete={removeItem} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function EditableItem({ item, onSave, onDelete } : { item:any; onSave:(it:any)=>void; onDelete:(id:string)=>void }) {
  const [stem, setStem] = useState(item.stem || '')
  const [options, setOptions] = useState<Option[]>(item.options || [])
  const [correctKey, setCorrectKey] = useState<string>(item.correctKey || 'A')
  const [level, setLevel] = useState<number>(item.level || 3)
  const changed = stem !== item.stem || JSON.stringify(options) !== JSON.stringify(item.options) || correctKey !== item.correctKey || level !== item.level

  return (
    <div className="border rounded-lg p-3">
      <Textarea value={stem} onChange={e=>setStem(e.target.value)} rows={2} />
      <div className="mt-2 grid sm:grid-cols-2 gap-2">
        {options.map((o, idx) => (
          <div key={o.key} className="flex items-center gap-2">
            <span className="font-mono text-sm w-6">{o.key}.</span>
            <Input value={o.text} onChange={e=>setOptions(prev=> prev.map((p,i)=> i===idx?{...p, text: (e.target as HTMLInputElement).value}:p))} />
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <label className="text-sm text-gray-600">Correcta:</label>
        <Select value={correctKey} onChange={e=>setCorrectKey((e.target as HTMLSelectElement).value)}>
          {options.map(o => <option key={o.key} value={o.key}>{o.key}</option>)}
        </Select>
        <label className="text-sm text-gray-600 ml-2">Nivel:</label>
        <Select value={level} onChange={e=>setLevel(Number((e.target as HTMLSelectElement).value))}>
          {[1,2,3,4,5].map(n=> <option key={n} value={n}>L{n}</option>)}
        </Select>
        <div className="ml-auto flex gap-2">
          <Button disabled={!changed} onClick={()=>onSave({ ...item, stem, options, correctKey, level })} variant={changed? 'primary':'ghost'} size="sm">Guardar</Button>
          <Button onClick={()=>onDelete(item.id)} variant="danger" size="sm">Eliminar</Button>
        </div>
      </div>
    </div>
  )
}


