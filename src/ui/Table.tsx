import React from 'react'

export function TableContainer({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={`overflow-auto border rounded-2xl bg-[var(--primary-bg)] shadow ${className}`.trim()}>
      {children}
    </div>
  )
}


