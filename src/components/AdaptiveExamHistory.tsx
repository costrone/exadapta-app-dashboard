import { useEffect, useState } from 'react'
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  where,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { Button } from '../ui/Button'
import { useToast } from '../ui/toast'

type AdaptiveExamHistoryRecord = {
  id: string
  userId: string
  bankId: string
  title: string
  subject: string
  course?: string
  numQuestions: number
  items?: { stem: string; options: { key: string; text: string }[]; correctKey: string; level: number }[]
  createdAt?: any
}

type AdaptiveExamHistoryProps = {
  userId?: string | null
  refreshKey?: number
  onClose: () => void
  onEdit: (record: AdaptiveExamHistoryRecord) => void
}

export function AdaptiveExamHistory({
  userId,
  refreshKey,
  onClose,
  onEdit,
}: AdaptiveExamHistoryProps) {
  const { show } = useToast()
  const [loading, setLoading] = useState(false)
  const [records, setRecords] = useState<AdaptiveExamHistoryRecord[]>([])

  useEffect(() => {
    if (!userId) {
      setRecords([])
      return
    }
    let mounted = true
    const load = async () => {
      setLoading(true)
      try {
        const q = query(
          collection(db, 'generatedAdaptiveExams'),
          where('userId', '==', userId),
          orderBy('createdAt', 'desc')
        )
        const snap = await getDocs(q)
        if (!mounted) return
        const mapped = snap.docs.map(
          (d) => ({ id: d.id, ...(d.data() as any) }) as AdaptiveExamHistoryRecord
        )
        setRecords(mapped)
      } catch (err: any) {
        show(
          err?.message ||
            'No se pudo cargar el historial de exámenes adaptativos.',
          'error'
        )
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [userId, refreshKey, show])

  const formatDate = (record: AdaptiveExamHistoryRecord) => {
    const ts: any = record.createdAt
    let date = new Date()
    if (ts?.toDate) {
      date = ts.toDate()
    } else if (typeof ts === 'number') {
      date = new Date(ts)
    }
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  const handleDelete = async (record: AdaptiveExamHistoryRecord) => {
    const confirmed = window.confirm(
      '¿Seguro que quieres eliminar este examen adaptativo del historial?'
    )
    if (!confirmed) return
    try {
      await deleteDoc(doc(db, 'generatedAdaptiveExams', record.id))
      setRecords((prev) => prev.filter((r) => r.id !== record.id))
      show('Examen adaptativo eliminado del historial.', 'success')
    } catch (err: any) {
      show(
        err?.message || 'No se pudo eliminar el examen adaptativo.',
        'error'
      )
    }
  }

  const handleDownload = (record: AdaptiveExamHistoryRecord) => {
    const items = record.items || []
    if (!items.length) {
      show('No hay ítems almacenados para exportar.', 'info')
      return
    }
    const headers = ['Pregunta', 'A', 'B', 'C', 'D', 'Correcta', 'Nivel']
    const rows = items.map((item) => [
      item.stem,
      item.options?.find((o) => o.key === 'A')?.text || '',
      item.options?.find((o) => o.key === 'B')?.text || '',
      item.options?.find((o) => o.key === 'C')?.text || '',
      item.options?.find((o) => o.key === 'D')?.text || '',
      item.correctKey,
      item.level != null ? String(item.level) : '',
    ])
    const csv = [headers, ...rows]
      .map((row) =>
        row
          .map((cell) => {
            const s = cell.replace(/"/g, '""')
            return /[",\n]/.test(s) ? `"${s}"` : s
          })
          .join(',')
      )
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `examen_adaptativo_${(record.subject || 'banco')
      .replace(/\s+/g, '_')
      .toLowerCase()}_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="rounded-xl border p-4 space-y-4 bg-white dark:bg-slate-900">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Historial de exámenes adaptativos</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Bancos generados mediante el generador de IA.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cerrar
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-600">Cargando historial…</p>
      ) : records.length === 0 ? (
        <p className="text-sm text-gray-600">
          Todavía no has generado exámenes adaptativos con IA.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 dark:text-gray-400">
                <th className="py-2 pr-4 font-medium">Fecha</th>
                <th className="py-2 pr-4 font-medium">Materia</th>
                <th className="py-2 pr-4 font-medium">Título</th>
                <th className="py-2 pr-4 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {records.map((record) => (
                <tr key={record.id} className="align-top">
                  <td className="py-2 pr-4">{formatDate(record)}</td>
                  <td className="py-2 pr-4">{record.subject || '—'}</td>
                  <td className="py-2 pr-4">
                    <div className="font-medium text-gray-900 dark:text-gray-100">
                      {record.title || 'Banco generado'}
                    </div>
                    {record.course && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Curso: {record.course}
                      </div>
                    )}
                  </td>
                  <td className="py-2 pr-0">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onEdit(record)}
                      >
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownload(record)}
                      >
                        Descargar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(record)}
                      >
                        Eliminar
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

