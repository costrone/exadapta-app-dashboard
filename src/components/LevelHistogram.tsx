export function LevelHistogram({ entries } : { entries: { level: string, count: number }[] }) {
  if (!entries.length) return null
  const max = Math.max(...entries.map(e=>e.count))
  return (
    <div className="mt-4">
      <div className="text-sm text-gray-600 mb-2">Distribución por nivel estimado</div>
      <div className="space-y-1">
        {entries.map(e => (
          <div key={e.level} className="flex items-center gap-2">
            <div className="w-10 text-right text-sm">L{e.level}</div>
            <div className="h-4 bg-gray-100 rounded w-full">
              <div className="h-4 bg-blue-500 rounded" style={{ width: `${(e.count/max)*100}%` }}></div>
            </div>
            <div className="w-8 text-sm">{e.count}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
