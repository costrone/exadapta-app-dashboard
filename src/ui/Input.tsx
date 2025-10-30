import React from 'react'

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { className = '', ...props }, ref
) {
  return (
    <input
      ref={ref}
      {...props}
      className={`w-full border rounded-lg px-3 py-2 bg-[var(--primary-bg)] text-[var(--primary-text)] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-600 ${className}`.trim()}
    />
  )
})


