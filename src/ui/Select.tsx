import React from 'react'

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className = '', children, ...props }, ref
) {
  return (
    <select
      ref={ref}
      {...props}
      className={`border rounded-lg px-3 py-2 bg-[var(--primary-bg)] text-[var(--primary-text)] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-600 ${className}`.trim()}
    >
      {children}
    </select>
  )
})


