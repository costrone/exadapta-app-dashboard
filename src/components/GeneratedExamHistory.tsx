import { useEffect, useState } from 'react'
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  deleteDoc,
  doc,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { Button } from '../ui/Button'
import { GeneratedExamRecord } from '../types/generatedExam'
import { useToast } from '../ui/toast'
import { createExamDoc } from '../utils/examDoc'
import { saveAs } from 'file-saver'

type GeneratedExamHistoryProps = {
  userId?: string | null
  refreshKey?: number
  onEdit: (entry: GeneratedExamRecord) => void
  onClose: () => void
}

export function GeneratedExamHistory({
  userId,
  refreshKey,
  onEdit,
  onClose,
}: GeneratedExamHistoryProps) {
  const { show } = useToast()
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<GeneratedExamRecord[]>([])

  const hasItems = items.length > 0

  useEffect(() => {
    if (!userId) {
      setItems([])
      return
    }
    let mounted = true
    const fetchHistory = async () => {
      setLoading(true)
      try {
        const q = query(
          collection(db, 'generatedExams'),
          where('userId', '==', userId),
          orderBy('createdAt', 'desc')
        )
        const snap = await getDocs(q)
        if (!mounted) return
        const mapped = snap.docs.map(
          (d) =>
            ({
              id: d.id,
              ...(d.data() as any),
            } as GeneratedExamRecord)
        )
        setItems(mapped)
      } catch (err: any) {
        show(
          err?.message ||
            'No se pudo cargar el historial de exámenes generados.',
          'error'
        )
      } finally {
        if (mounted) setLoading(false)
      }
    }
    fetchHistory()
    return () => {
      mounted = false
    }
  }, [userId, refreshKey, show])

  const formatDate = (record: GeneratedExamRecord) => {
    const ts: any = record.createdAt || record.updatedAt
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

  const handleDelete = async (record: GeneratedExamRecord) => {
    if (!userId) return
    const confirmed = window.confirm(
      '¿Seguro que quieres eliminar este examen del historial? Esta acción no se puede deshacer.'
    )
    if (!confirmed) return
    try {
      await deleteDoc(doc(db, 'generatedExams', record.id))
      setItems((prev) => prev.filter((i) => i.id !== record.id))
      show('Examen eliminado del historial.', 'success')
    } catch (err: any) {
      show(err?.message || 'No se pudo eliminar el examen.', 'error')
    }
  }

  const handleDownload = async (record: GeneratedExamRecord) => {
    try {
      const blob = await createExamDoc({
        examText: record.examText,
        subject: record.subject || '',
        fontFamily: record.fontFamily || 'Arial',
        fontSize: record.fontSize || 12,
        tipoPreguntas: record.tipoPreguntas || 'desarrollo',
        createdAt: record.createdAt?.toDate?.() || new Date(),
      })
      const fileName = `examen_adaptado_${(record.subject || 'examen')
        .replace(/\s+/g, '_')
        .toLowerCase()}_${new Date().toISOString().split('T')[0]}.docx`
      saveAs(blob, fileName)
    } catch (err: any) {
      show(err?.message || 'No se pudo descargar el examen.', 'error')
    }
  }

  return (
    <div className="rounded-xl border p-4 space-y-4 bg-white dark:bg-slate-900">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Historial de exámenes</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Accede a los exámenes generados anteriormente para editarlos, volver a
            descargarlos o eliminarlos.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cerrar
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-600">Cargando historial…</p>
      ) : !hasItems ? (
        <p className="text-sm text-gray-600">
          Todavía no has generado exámenes adaptados. Cuando lo hagas, aparecerán
          aquí.
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
              {items.map((record) => (
                <tr key={record.id} className="align-top">
                  <td className="py-2 pr-4">{formatDate(record)}</td>
                  <td className="py-2 pr-4">{record.subject || '—'}</td>
                  <td className="py-2 pr-4">
                    <div className="font-medium text-gray-900 dark:text-gray-100">
                      {record.title || 'Examen sin título'}
                    </div>
                    {record.summary && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {record.summary}
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

