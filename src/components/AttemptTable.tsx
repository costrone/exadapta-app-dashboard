export function AttemptTable({ attempts } : { attempts: any[] }) {
  if (!attempts.length) return <p className="text-gray-600">No hay intentos aún.</p>
  return (
    <div className="overflow-auto border rounded-xl">
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
              <td className="px-3 py-2">{a.status}</td>
              <td className="px-3 py-2">{a.startAt?.toString?.() ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
