import React from 'react'

type Variant = 'default' | 'success' | 'warning' | 'danger' | 'info'

export function Badge({ children, variant = 'default', className = '' }: { children: React.ReactNode; variant?: Variant; className?: string }) {
  const base = 'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border'
  const styles: Record<Variant, string> = {
    default: 'bg-gray-50 text-gray-700 border-gray-200',
    success: 'bg-green-50 text-green-700 border-green-200',
    warning: 'bg-yellow-50 text-yellow-800 border-yellow-300',
    danger:  'bg-red-50 text-red-700 border-red-200',
    info:    'bg-blue-50 text-blue-700 border-blue-200',
  }
  return <span className={`${base} ${styles[variant]} ${className}`.trim()}>{children}</span>
}


