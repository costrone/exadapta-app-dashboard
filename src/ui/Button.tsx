import React from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
}

function variantClasses(variant: ButtonVariant, disabled?: boolean): string {
  const common = 'border rounded-xl transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed'
  if (disabled) return common
  switch (variant) {
    case 'primary':
      return `${common} bg-blue-600 text-white border-blue-600 hover:bg-blue-700`;
    case 'secondary':
      return `${common} bg-gold-500 text-blue-700 border-gold-500 hover:bg-gold-600`;
    case 'outline':
      return `${common} bg-transparent text-blue-700 border-blue-600 hover:bg-blue-50`;
    case 'danger':
      return `${common} text-red-700 border-red-200 hover:bg-red-50`;
    case 'ghost':
    default:
      return `${common} border hover:bg-gray-50`;
  }
}

function sizeClasses(size: ButtonSize): string {
  switch (size) {
    case 'sm':
      return 'px-2.5 py-1.5 text-sm';
    case 'lg':
      return 'px-5 py-2.5 text-base';
    case 'md':
    default:
      return 'px-4 py-2 text-sm';
  }
}

export function Button({ variant = 'ghost', size = 'md', className = '', disabled, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled}
      className={`${variantClasses(variant, disabled)} ${sizeClasses(size)} ${className}`.trim()}
    />
  )
}


