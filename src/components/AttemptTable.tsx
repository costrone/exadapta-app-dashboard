import { TableContainer } from '../ui/Table'
import { Badge } from '../ui/Badge'

function formatDate(d: any) {
  try {
    const date = typeof d === 'string' ? new Date(d) : d?.toDate?.() || new Date(d)
    return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
  } catch {
    return ''
  }
}

export function AttemptTable({ attempts } : { attempts: any[] }) {
  if (!attempts.length) return <p className="text-gray-600">No hay intentos aún.</p>
  return (
    <TableContainer>
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="text-left px-3 py-2">Alumno</th>
            <th className="text-left px-3 py-2">Level</th>
            <th className="text-left px-3 py-2">Theta</th>
            <th className="text-left px-3 py-2">Estado</th>
            <th className="text-left px-3 py-2">Inicio</th>
          </tr>
        </thead>
        <tbody>
          {attempts.map(a => (
            <tr key={a.id} className="border-t">
              <td className="px-3 py-2 font-mono">{a.userId}</td>
              <td className="px-3 py-2">{a.levelEstimate ?? '-'}</td>
              <td className="px-3 py-2">{typeof a.thetaEstimate === 'number' ? a.thetaEstimate.toFixed(2) : '-'}</td>
              <td className="px-3 py-2">
                <Badge variant={a.status==='active' ? 'info' : a.status==='finished' ? 'success' : 'default'}>
                  {a.status}
                </Badge>
              </td>
              <td className="px-3 py-2">{formatDate(a.startAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableContainer>
  )
}
