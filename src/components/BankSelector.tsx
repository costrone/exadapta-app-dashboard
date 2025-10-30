import { useEffect, useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { Select } from '../ui/Select'

export function BankSelector({ value, onChange, subject } : { value: string; onChange: (id:string)=>void; subject?: string }) {
  const [banks, setBanks] = useState<any[]>([])
  useEffect(() => {
    (async () => {
      const snap = await getDocs(collection(db, 'banks'))
      setBanks(snap.docs.map(d => ({ id: d.id, ...(d.data() as any)})))
    })()
  }, [])
  const filtered = subject ? banks.filter(b => (b.subject || '').toLowerCase() === subject.toLowerCase()) : banks
  return (
    <div className="flex items-center gap-2">
      <label className="text-sm text-gray-600">Banco:</label>
      <Select value={value} onChange={e=>onChange(e.target.value)}>
        <option value="">— Selecciona un banco —</option>
        {filtered.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
      </Select>
    </div>
  )
}
