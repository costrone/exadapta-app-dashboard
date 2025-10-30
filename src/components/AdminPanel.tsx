import { useEffect, useMemo, useState } from 'react'
import { collection, deleteDoc, doc, getDocs, setDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { Button } from '../ui/Button'
import { useToast } from '../ui/toast'

type Entry = { email: string; role: 'teacher'|'admin' }

export function AdminPanel() {
  const { show } = useToast()
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'teacher'|'admin'>('teacher')

  async function load() {
    setLoading(true)
    const snap = await getDocs(collection(db, 'roles'))
    const list = snap.docs.map(d => ({ email: d.id, ...(d.data() as any) })) as Entry[]
    setEntries(list.sort((a,b)=> a.email.localeCompare(b.email)))
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const canAdd = useMemo(() => {
    const re = /.+@.+\..+/
    return re.test(email)
  }, [email])

  async function addEntry() {
    const id = email.trim()
    await setDoc(doc(db, 'roles', id), { role })
    setEmail('')
    setRole('teacher')
    await load()
    show('Rol añadido', 'success')
  }

  async function removeEntry(e: Entry) {
    if (!confirm(`¿Quitar ${e.email} (${e.role}) de la lista?`)) return
    await deleteDoc(doc(db, 'roles', e.email))
    await load()
    show('Rol eliminado', 'info')
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border p-4 bg-blue-50/30">
        <h2 className="font-semibold">Gestión de roles</h2>
        <p className="text-sm text-gray-600 mt-1">Añade emails con rol docente. Por seguridad, no se escribe nada sensible en el cliente.</p>
        <div className="mt-4 flex flex-wrap gap-3 items-center">
          <Input value={email} onChange={e=>setEmail((e.target as HTMLInputElement).value)} placeholder="profesor@centro.es" className="min-w-[260px]" />
          <Select value={role} onChange={e=>setRole((e.target as HTMLSelectElement).value as any)}>
            <option value="teacher">teacher</option>
            <option value="admin">admin</option>
          </Select>
          <Button disabled={!canAdd} onClick={addEntry} variant={canAdd? 'primary':'ghost'}>Añadir</Button>
        </div>
      </div>

      <div className="rounded-xl border overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-medium">Listado</h3>
          {loading && <span className="text-sm text-gray-600">Cargando…</span>}
        </div>
        {entries.length === 0 ? (
          <div className="p-4 text-sm text-gray-600">Aún no hay entradas.</div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-3 py-2">Email</th>
                <th className="text-left px-3 py-2">Rol</th>
                <th className="text-left px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {entries.map(e => (
                <tr key={e.email} className="border-t">
                  <td className="px-3 py-2 font-mono">{e.email}</td>
                  <td className="px-3 py-2">{e.role}</td>
                  <td className="px-3 py-2 text-right">
                    <Button onClick={()=>removeEntry(e)} variant="danger" size="sm">Quitar</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}


