import { useEffect, useMemo, useState } from 'react'
import { collection, deleteDoc, doc, getDocs, setDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'

type Entry = { email: string; role: 'teacher'|'admin' }

export function AdminPanel() {
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
  }

  async function removeEntry(e: Entry) {
    if (!confirm(`¿Quitar ${e.email} (${e.role}) de la lista?`)) return
    await deleteDoc(doc(db, 'roles', e.email))
    await load()
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border p-4 bg-blue-50/30">
        <h2 className="font-semibold">Gestión de roles</h2>
        <p className="text-sm text-gray-600 mt-1">Añade emails con rol docente. Por seguridad, no se escribe nada sensible en el cliente.</p>
        <div className="mt-4 flex flex-wrap gap-3 items-center">
          <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="profesor@centro.es" className="border rounded-lg px-3 py-2 min-w-[260px]" />
          <select value={role} onChange={e=>setRole(e.target.value as any)} className="border rounded-lg px-3 py-2">
            <option value="teacher">teacher</option>
            <option value="admin">admin</option>
          </select>
          <button disabled={!canAdd} onClick={addEntry} className={"px-4 py-2 rounded-xl border "+(canAdd?"bg-blue-600 text-white border-blue-600 hover:bg-blue-700":"opacity-50 cursor-not-allowed")}>Añadir</button>
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
                    <button onClick={()=>removeEntry(e)} className="px-3 py-1.5 rounded-lg border hover:bg-red-50 text-red-700 border-red-200">Quitar</button>
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


