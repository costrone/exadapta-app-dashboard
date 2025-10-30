import React from 'react'

export function Card({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={`w-full p-6 rounded-2xl bg-[var(--primary-bg)] shadow-brand border ${className}`.trim()}>
      {children}
    </div>
  )
}

export function CardHeader({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={`mb-4 ${className}`.trim()}>
      {children}
    </div>
  )
}


