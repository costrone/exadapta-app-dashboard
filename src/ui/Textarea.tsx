import React from 'react'

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className = '', ...props }, ref
) {
  return (
    <textarea
      ref={ref}
      {...props}
      className={`w-full border rounded-lg px-3 py-2 bg-[var(--primary-bg)] text-[var(--primary-text)] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-600 ${className}`.trim()}
    />
  )
})


